import { ContextProvider } from "./ContextProvider";

/**
 *
 */
export class ContextWebGL extends ContextProvider {
    /**
     *
     */
    private _canvas: HTMLCanvasElement;

    /**
     *
     */
    private _context: WebGLRenderingContext | WebGL2RenderingContext;

    /**
     * The WebGLRenderingContext of the canvas
     */
    private _texture_ref: WebGLTexture | null = null;

    /**
     * The WebGLRenderingContext of the canvas
     */
    private _shader_program: WebGLProgram | null = null;

    /**
     * The alternative frame buffer to draw on.
     */
    private _frame_buffer: WebGLFramebuffer | null = null;

    /**
     *
     */
    get native() {
        return this._context;
    }

    /**
     *
     */
    set frame_buffer(fb: WebGLFramebuffer) {
        this._frame_buffer = fb;
    }

    /**
     *
     */
    constructor(
        canvas: HTMLCanvasElement,
        version: "webgl" | "webgl2" = "webgl",
        context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean },
    ) {
        super();

        const context = canvas.getContext(version, context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a ${version} context from canvas`);
        }

        this._canvas = canvas;
        this._context = version === "webgl" ? (context as WebGLRenderingContext) : (context as WebGL2RenderingContext);

        this._initShaderProgram();
        this._initBuffers();
        this._initTexture();
    }

    /**
     *
     */
    drawFrame({ frame, left, top }: { frame: VideoFrame | OffscreenCanvas; left: number; top: number }): void {
        const gl = this._context;

        if (this._frame_buffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._frame_buffer);
        }

        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const frameWidth = (frame as OffscreenCanvas).width || (frame as VideoFrame).displayWidth;
        const frameHeight = (frame as OffscreenCanvas).height || (frame as VideoFrame).displayHeight;

        const ls = gl.getUniformLocation(this._shader_program!, "size");
        const lo = gl.getUniformLocation(this._shader_program!, "offset");
        gl.uniform2fv(ls, [this._canvas.width / frameWidth, this._canvas.height / frameHeight]);
        gl.uniform2fv(lo, [left / frameWidth, top / frameHeight]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture_ref);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     *
     */
    refreshSize(): void {
        this._context.viewport(0, 0, this._canvas.width, this._canvas.height);
    }

    /**
     *
     */
    release(): void {
        const gl = this._context;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    /**
     *
     */
    private _initShaderProgram(): void {
        const gl = this._context!;
        // Vertex shader
        const vertex_shader_source = `
            attribute vec2 position;
            varying vec2 texCoord;
            uniform vec2 size;
            uniform vec2 offset;

            void main() {
                texCoord = (position + 1.0) * 0.5;
                texCoord.y = 1.0 - texCoord.y;
                texCoord = size * texCoord + offset;
                gl_Position = vec4(position, 0.0, 1.0);
            }`;
        const vertex_shader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertex_shader, vertex_shader_source);
        gl.compileShader(vertex_shader);
        if (!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)) {
            console.log("Vertex shader failed to compile: " + gl.getShaderInfoLog(vertex_shader));
        }

        // Fragment shader
        const fragment_shader_source = `
            precision mediump float;
            varying vec2 texCoord;
            uniform sampler2D texture;

            void main() {
                gl_FragColor = texture2D(texture, texCoord);
            }`;
        const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragment_shader, fragment_shader_source);
        gl.compileShader(fragment_shader);
        if (!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)) {
            console.log("Fragment shader failed to compile: " + gl.getShaderInfoLog(fragment_shader));
        }

        // Shader program
        const shader_program = gl.createProgram()!;
        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);
        gl.linkProgram(shader_program);
        gl.useProgram(shader_program);
        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.log("Program failed to compile: " + gl.getProgramInfoLog(shader_program));
        }
        gl.useProgram(shader_program);
        this._shader_program = shader_program;
    }

    /**
     *
     */
    private _initBuffers(): void {
        const gl = this._context!;

        const vertex_buffer = gl.createBuffer();
        const vertices = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const position_attribute_location = gl.getAttribLocation(this._shader_program!, "position");
        gl.enableVertexAttribArray(position_attribute_location);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     *
     */
    private _initTexture(): void {
        const gl = this._context!;
        this._texture_ref = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this._texture_ref);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const texture_uniform_location = gl.getUniformLocation(this._shader_program!, "texture");
        gl.uniform1i(texture_uniform_location, 0);
    }
}

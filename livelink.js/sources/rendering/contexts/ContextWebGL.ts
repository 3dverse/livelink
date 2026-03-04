import { ContextProvider, type FrameSection } from "./ContextProvider";

/**
 * @category Rendering Surfaces
 */
export type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * @category Rendering Contexts
 */
export class ContextWebGL extends ContextProvider {
    /**
     *
     */
    #canvas: Canvas;

    /**
     *
     */
    #context: WebGLRenderingContext | WebGL2RenderingContext;

    /**
     * The WebGLRenderingContext of the canvas
     */
    #texture_ref: WebGLTexture | null = null;

    /**
     * The WebGLRenderingContext of the canvas
     */
    #shader_program: WebGLProgram | null = null;

    /**
     * The alternative frame buffer to draw on.
     */
    #frame_buffer: WebGLFramebuffer | null = null;

    /**
     * The vertex buffer for the full screen quad.
     */
    #vertex_buffer: WebGLBuffer | null = null;

    /**
     *
     */
    get native(): WebGLRenderingContext | WebGL2RenderingContext {
        return this.#context;
    }

    /**
     *
     */
    set frame_buffer(fb: WebGLFramebuffer) {
        this.#frame_buffer = fb;
    }

    /**
     *
     */
    constructor(
        canvas: Canvas,
        version: "webgl" | "webgl2" = "webgl",
        context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean },
    ) {
        super();

        const context = canvas.getContext(version, context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a ${version} context from canvas`);
        }

        this.#canvas = canvas;
        this.#context = version === "webgl" ? (context as WebGLRenderingContext) : (context as WebGL2RenderingContext);

        this._initShaderProgram();
        this._initBuffers();
        this._initTexture();
    }

    /**
     *
     */
    drawFrameSection({ frame_section }: { frame_section: FrameSection }): void {
        const gl = this.#context;

        if (this.#frame_buffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.#frame_buffer);
        }

        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const ls = gl.getUniformLocation(this.#shader_program!, "size");
        const lo = gl.getUniformLocation(this.#shader_program!, "offset");
        gl.uniform2fv(ls, [frame_section.section.width, frame_section.section.height]);
        gl.uniform2fv(lo, [frame_section.section.left, frame_section.section.top]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame_section.pixels);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     *
     */
    override refreshSize(): void {
        this.#context.viewport(0, 0, this.#canvas.width, this.#canvas.height);
    }

    /**
     *
     */
    release(): void {
        const gl = this.#context;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.deleteTexture(this.#texture_ref);
        gl.deleteProgram(this.#shader_program);
        gl.deleteBuffer(this.#vertex_buffer);
    }

    /**
     *
     */
    private _initShaderProgram(): void {
        const gl = this.#context!;
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
            console.error("Vertex shader failed to compile: " + gl.getShaderInfoLog(vertex_shader));
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
            console.error("Fragment shader failed to compile: " + gl.getShaderInfoLog(fragment_shader));
        }

        // Shader program
        const shader_program = gl.createProgram()!;
        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);
        gl.linkProgram(shader_program);
        gl.useProgram(shader_program);
        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.error("Program failed to compile: " + gl.getProgramInfoLog(shader_program));
        }
        gl.useProgram(shader_program);
        this.#shader_program = shader_program;

        gl.deleteShader(vertex_shader);
        gl.deleteShader(fragment_shader);
    }

    /**
     *
     */
    private _initBuffers(): void {
        const gl = this.#context!;

        this.#vertex_buffer = gl.createBuffer();
        const vertices = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const position_attribute_location = gl.getAttribLocation(this.#shader_program!, "position");
        gl.enableVertexAttribArray(position_attribute_location);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     *
     */
    private _initTexture(): void {
        const gl = this.#context!;
        this.#texture_ref = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const texture_uniform_location = gl.getUniformLocation(this.#shader_program!, "texture");
        gl.uniform1i(texture_uniform_location, 0);
    }
}

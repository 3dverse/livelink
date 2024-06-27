import { ContextProvider, Quat, Vec3 } from "@3dverse/livelink";
import { mat4, quat, vec3 } from "gl-matrix";

type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 *
 */
export class XRContext extends ContextProvider {
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
    screen_distance: number = 25;

    /**
     *
     */
    readonly #neutral_direction: vec3 = vec3.fromValues(0, 0, 1);

    /**
     *
     */
    #billboard_position: vec3 = vec3.create();
    #billboard_model_matrix: mat4 = mat4.create();
    #billboard_translation_matrix: mat4 = mat4.create();
    #billboard_orientation_matrix: mat4 = mat4.create();

    /**
     *
     */
    #camera_position: vec3 = vec3.create();
    #camera_orientation: quat = quat.create();
    #camera_direction: vec3 = vec3.create();

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
        canvas: Canvas,
        version: "webgl" | "webgl2" = "webgl",
        context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean },
    ) {
        super();

        const context = canvas.getContext(version, context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a ${version} context from canvas`);
        }

        this._context = version === "webgl" ? (context as WebGLRenderingContext) : (context as WebGL2RenderingContext);

        this.#initShaderProgram();
        this.#initBuffers();
        this.#initTexture();
    }

    /**
     *
     */
    drawFrame({
        frame,
        xr_views,
    }: {
        frame: VideoFrame | OffscreenCanvas;
        left: number;
        top: number;
        xr_views: Array<{
            view: XRView;
            viewport: XRViewport;
            frame_camera_transform: {
                position: Vec3;
                orientation: Quat;
            };
        }>;
    }): void {
        const gl = this._context;

        if (this._frame_buffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._frame_buffer);
        }

        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const sizeLocation = gl.getUniformLocation(this._shader_program!, "size");
        const offsetLocation = gl.getUniformLocation(this._shader_program!, "offset");
        const scaleLocation = gl.getUniformLocation(this._shader_program!, "scale");

        const viewMatrixLocation = gl.getUniformLocation(this._shader_program!, "viewMatrix");
        const projectionMatrixLocation = gl.getUniformLocation(this._shader_program!, "projectionMatrix");
        const billboardMatrixLocation = gl.getUniformLocation(this._shader_program!, "billboardMatrix");

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture_ref);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

        const fovV = Math.atan(1 / xr_views[0].view.projectionMatrix[5]) * 2;

        const aspectRatio = xr_views[0].viewport.width / xr_views[0].viewport.height;
        const scaleY = this.screen_distance * Math.tan(fovV * 0.5);
        const scaleX = scaleY * aspectRatio;

        const viewportWidth = 1 / xr_views.length;
        const viewportHeight = 1;

        gl.uniform2fv(scaleLocation, [scaleX, scaleY]);
        gl.uniform2fv(sizeLocation, [viewportWidth, viewportHeight]);

        let current_offset = 0;
        for (const { view, viewport, frame_camera_transform } of xr_views) {
            vec3.set(
                this.#camera_position,
                frame_camera_transform.position[0],
                frame_camera_transform.position[1],
                frame_camera_transform.position[2],
            );
            quat.set(
                this.#camera_orientation,
                frame_camera_transform.orientation[0],
                frame_camera_transform.orientation[1],
                frame_camera_transform.orientation[2],
                frame_camera_transform.orientation[3],
            );

            vec3.transformQuat(this.#camera_direction, this.#neutral_direction, this.#camera_orientation);
            vec3.scale(this.#camera_direction, this.#camera_direction, this.screen_distance);
            vec3.sub(this.#billboard_position, this.#camera_position, this.#camera_direction);

            const billboardMatrix = this.#computeBillboardMatrix(this.#billboard_position);

            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            gl.uniformMatrix4fv(viewMatrixLocation, false, view.transform.inverse.matrix);
            gl.uniformMatrix4fv(projectionMatrixLocation, false, view.projectionMatrix);
            gl.uniformMatrix4fv(billboardMatrixLocation, false, billboardMatrix);

            gl.uniform2fv(offsetLocation, [current_offset, 0]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            current_offset += viewportWidth;
        }
    }

    /**
     *
     */
    refreshSize(): void {}

    /**
     *
     */
    release(): void {
        const gl = this._context;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     *
     */
    #computeBillboardMatrix(billboard_position: vec3): Float32Array {
        mat4.fromQuat(this.#billboard_orientation_matrix, this.#camera_orientation);
        mat4.fromTranslation(this.#billboard_translation_matrix, billboard_position);
        mat4.multiply(
            this.#billboard_model_matrix,
            this.#billboard_translation_matrix,
            this.#billboard_orientation_matrix,
        );

        return this.#billboard_model_matrix as Float32Array;
    }

    /**
     *
     */
    #initShaderProgram(): void {
        const gl = this._context!;
        // Vertex shader
        const vertex_shader_source = `
            attribute vec2 position;
            varying vec2 texCoord;

            uniform mat4 viewMatrix;
            uniform mat4 projectionMatrix;
            uniform vec2 scale;
            uniform mat4 billboardMatrix;

            uniform vec2 size;
            uniform vec2 offset;

            void main() {
                texCoord = (position + 1.0) * 0.5;
                texCoord.y = 1.0 - texCoord.y;
                texCoord = size * texCoord + offset;
                gl_Position = projectionMatrix * viewMatrix * billboardMatrix * vec4(position * scale, 0.0, 1.0);
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
    #initBuffers(): void {
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
    #initTexture(): void {
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

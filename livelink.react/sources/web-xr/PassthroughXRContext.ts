import { ContextProvider, FrameMetaData, FrameSection, Quat, Vec3 } from "@3dverse/livelink";

type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 *
 */
export class PassthroughXRContext extends ContextProvider {
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
     *
     */
    #last_frame_section: FrameSection | null = null;

    /**
     *
     */
    screen_distance: number = 25;

    /**
     *
     */
    scale_factor: number = 1;

    /**
     *
     */
    fake_alpha_enabled: boolean = false;

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
        context_type: "webgl" | "webgl2" = "webgl",
        context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean },
    ) {
        super();

        const context = canvas.getContext(context_type, context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a ${context_type} context from canvas`);
        }

        this.#context =
            context_type === "webgl" ? (context as WebGLRenderingContext) : (context as WebGL2RenderingContext);

        this.#initShaderProgram();
        this.#initBuffers();
        this.#initTexture();
    }

    /**
     * @internal
     */
    drawFrameSection({ frame_section }: { frame_section: FrameSection }): void {
        this.#last_frame_section = frame_section;
    }

    /**
     *
     */
    get meta_data(): FrameMetaData | null {
        return this.#last_frame_section?.meta_data || null;
    }

    /**
     *
     */
    drawXRFrame({
        xr_views,
    }: {
        xr_views: Array<{
            view: XRView;
            viewport: XRViewport;
            frame_camera_transform: {
                position: Vec3;
                orientation: Quat;
            };
        }>;
    }): void {
        if (!this.#last_frame_section) {
            return;
        }

        const gl = this.#context;

        if (this.#frame_buffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.#frame_buffer);
        }

        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const ls = gl.getUniformLocation(this.#shader_program!, "size");
        const lo = gl.getUniformLocation(this.#shader_program!, "offset");

        const viewportWidth = this.#last_frame_section.section.width / xr_views.length;
        const viewportHeight = this.#last_frame_section.section.height;
        const combinedViewportWidth = xr_views.reduce((acc, { viewport }) => acc + viewport.width, 0);

        gl.uniform2fv(ls, [viewportWidth, viewportHeight]);

        for (const { viewport } of xr_views) {
            const viewport_offset = viewport.x / combinedViewportWidth;
            const frame_offset =
                this.#last_frame_section.section.left + viewport_offset * this.#last_frame_section.section.width;

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#last_frame_section.pixels);

            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            gl.uniform2fv(lo, [frame_offset, this.#last_frame_section.section.top]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
        const gl = this.#context;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     *
     */
    #initShaderProgram(): void {
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
    }

    /**
     *
     */
    #initBuffers(): void {
        const gl = this.#context!;

        const vertex_buffer = gl.createBuffer();
        const vertices = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const position_attribute_location = gl.getAttribLocation(this.#shader_program!, "position");
        gl.enableVertexAttribArray(position_attribute_location);
        gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     *
     */
    #initTexture(): void {
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

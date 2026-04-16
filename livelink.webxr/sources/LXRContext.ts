//------------------------------------------------------------------------------
import { mat4, quat, vec2, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import type { FrameMetaData, FrameSection, Quat, Vec3 } from "@3dverse/livelink";
import { ContextProvider } from "@3dverse/livelink";

//------------------------------------------------------------------------------
/**
 * @experimental
 * @category Rendering Contexts
 */
export class LXRContext extends ContextProvider {
    /**
     * The WebGLRenderingContext of the canvas
     */
    #context: WebGLRenderingContext | WebGL2RenderingContext;

    /**
     * WebGL texture updated each frame with decoded pixel data.
     */
    #texture_ref: WebGLTexture | null = null;

    /**
     * Shader program for rendering XR views.
     */
    #shader_program: WebGLProgram | null = null;

    /**
     * Alternative frame buffer to draw on.
     */
    #frame_buffer: WebGLFramebuffer | null = null;

    /**
     * Last drawn frame section, used for rendering and frame metadata.
     */
    #last_frame_section: FrameSection | null = null;

    /**
     * The distance from the camera to the screen, used for calculating the projection matrix.
     */
    screen_distance: number = 25;

    /**
     * The scale factor for resolution scaling. This is used to scale the size of the rendered frame in the XR views.
     */
    scale_factor: number = 1;

    /**
     * When enabled, simulates alpha transparency based on pixel luminance, useful for AR passthrough.
     */
    fake_alpha_enabled: boolean = false;

    /**
     * Overall transparency multiplier for the fake alpha effect.
     */
    fake_alpha_scale: number = 1;

    /**
     * Neutral forward direction in camera local space.
     */
    readonly #neutral_direction: vec3 = vec3.fromValues(0, 0, -1);

    /**
     * Billboard world-space position, recalculated each frame.
     */
    #billboard_position: vec3 = vec3.create();
    /**
     * Billboard model matrix, recalculated each frame to face the camera.
     */
    #billboard_model_matrix: mat4 = mat4.create();
    /**
     * Projection offset from the XR view matrix, used to handle off-center projections.
     */
    #projection_offset: vec2 = vec2.create();

    /**
     * Camera world-space position, updated each frame.
     */
    #camera_position: vec3 = vec3.create();
    /**
     * Camera orientation quaternion, updated each frame.
     */
    #camera_orientation: quat = quat.create();
    /**
     * Camera forward direction, derived from orientation each frame.
     */
    #camera_direction: vec3 = vec3.create();

    /**
     * The underlying WebGL rendering context.
     */
    get native(): WebGLRenderingContext | WebGL2RenderingContext {
        return this.#context;
    }

    /**
     * Custom framebuffer for rendering. Defaults to the canvas framebuffer.
     */
    set frame_buffer(fb: WebGLFramebuffer) {
        this.#frame_buffer = fb;
    }

    /**
     * Creates a new LXRContext instance.
     * @param canvas The HTMLCanvasElement or OffscreenCanvas to use for rendering.
     * @param context_type The type of WebGL context to create ("webgl" or "webgl2").
     * @param context_attributes Optional attributes for the WebGL context, including xrCompatible for XR rendering.
     * @throws Error if the context cannot be created.
     */
    constructor(
        canvas: HTMLCanvasElement | OffscreenCanvas,
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

        this.initialize();
    }

    /**
     * Initializes shaders, buffers, and textures.
     * @param enable_billboard Whether to include billboard calculations in the shader for facing the camera.
     */
    initialize({ enable_billboard = true }: { enable_billboard?: boolean } = {}): void {
        this.#initShaderProgram({ enable_billboard });
        this.#initBuffers();
        this.#initTexture();
    }

    /**
     * Stores the frame section to be rendered on the next XR frame
     * @param frame_section The section of the frame to render, including pixel data and metadata.
     */
    drawFrameSection({ frame_section }: { frame_section: FrameSection }): void {
        this.#last_frame_section = frame_section;
    }

    /**
     * Metadata of the last drawn frame section.
     */
    get meta_data(): FrameMetaData | null {
        return this.#last_frame_section?.meta_data || null;
    }

    /**
     * Renders all XR views for the current frame.
     * @param xr_views The XR views to render, containing view and projection matrices.
     * @param xr_viewports The corresponding viewports for each XR view, defining where to render on the canvas.
     * @param frame_camera_transforms The world-space camera transforms for this frame, used for billboard calculations.
     */
    drawXRFrame({
        xr_views,
        xr_viewports,
        frame_camera_transforms,
    }: {
        xr_views: readonly XRView[];
        xr_viewports: XRViewport[];
        frame_camera_transforms: {
            position: Vec3;
            orientation: Quat;
        }[];
    }): void {
        if (!this.#last_frame_section) {
            return;
        }

        const gl = this.#context;

        if (this.#frame_buffer !== null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.#frame_buffer);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        const sizeLocation = gl.getUniformLocation(this.#shader_program!, "size");
        const offsetLocation = gl.getUniformLocation(this.#shader_program!, "offset");
        const viewMatrixLocation = gl.getUniformLocation(this.#shader_program!, "viewMatrix");
        const viewOffsetLocation = gl.getUniformLocation(this.#shader_program!, "viewOffset");

        const projectionMatrixLocation = gl.getUniformLocation(this.#shader_program!, "projectionMatrix");
        const billboardMatrixLocation = gl.getUniformLocation(this.#shader_program!, "billboardMatrix");
        const fakeAlphaEnabledLocation = gl.getUniformLocation(this.#shader_program!, "fakeAlphaEnabled");
        const fakeAlphaScaleLocation = gl.getUniformLocation(this.#shader_program!, "fakeAlphaScale");

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#last_frame_section.pixels);

        const fovY = Math.atan(1 / xr_views[0].projectionMatrix[5]) * 2;

        const aspectRatio = xr_viewports[0].width / xr_viewports[0].height;
        const scaleY = this.scale_factor * this.screen_distance * Math.tan(fovY * 0.5);
        const scaleX = scaleY * aspectRatio;

        const viewportWidth = this.#last_frame_section.section.width / xr_views.length;
        const viewportHeight = this.#last_frame_section.section.height;

        gl.uniform2fv(sizeLocation, [viewportWidth, viewportHeight]);

        const combinedViewportWidth = xr_viewports.reduce((acc, { width }) => acc + width, 0);

        for (let index = 0; index < xr_views.length; index++) {
            const xr_view = xr_views[index];
            const xr_viewport = xr_viewports[index];
            const frame_camera_transform = frame_camera_transforms[index];
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

            // Compute the billboard position from the camera position and orientation
            vec3.transformQuat(this.#camera_direction, this.#neutral_direction, this.#camera_orientation);
            vec3.scaleAndAdd(
                this.#billboard_position,
                this.#camera_position,
                this.#camera_direction,
                this.screen_distance,
            );

            this.#projection_offset[0] = xr_view.projectionMatrix[8];
            this.#projection_offset[1] = xr_view.projectionMatrix[9];

            const billboardMatrix = this.#computeBillboardMatrix(this.#billboard_position, scaleX, scaleY);
            gl.uniform2fv(viewOffsetLocation, this.#projection_offset as Float32Array);

            gl.viewport(xr_viewport.x, xr_viewport.y, xr_viewport.width, xr_viewport.height);
            gl.uniformMatrix4fv(viewMatrixLocation, false, xr_view.transform.inverse.matrix);
            gl.uniformMatrix4fv(projectionMatrixLocation, false, xr_view.projectionMatrix);
            gl.uniformMatrix4fv(billboardMatrixLocation, false, billboardMatrix);
            gl.uniform1i(fakeAlphaEnabledLocation, this.fake_alpha_enabled ? 1 : 0);
            gl.uniform1f(fakeAlphaScaleLocation, this.fake_alpha_scale);

            const viewport_offset = xr_viewport.x / combinedViewportWidth;
            const frame_offset =
                this.#last_frame_section.section.left + viewport_offset * this.#last_frame_section.section.width;
            gl.uniform2fv(offsetLocation, [frame_offset, this.#last_frame_section.section.top]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    }

    /**
     *
     */
    override refreshSize(): void {}

    /**
     * Releases GPU resources held by this context.
     */
    release(): void {
        const gl = this.#context;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (this.#texture_ref) {
            gl.deleteTexture(this.#texture_ref);
        }
        if (this.#shader_program) {
            gl.deleteProgram(this.#shader_program);
        }
    }

    /**
     * Computes the billboard model matrix so it always faces the camera.
     * @param billboard_position The world-space position of the billboard.
     * @param scaleX The horizontal scale of the billboard based on the XR view's FOV and resolution scaling.
     * @param scaleY The vertical scale of the billboard based on the XR view's FOV and resolution scaling.
     */
    #computeBillboardMatrix(billboard_position: vec3, scaleX: number, scaleY: number): Float32Array {
        mat4.fromRotationTranslationScale(
            this.#billboard_model_matrix,
            this.#camera_orientation,
            billboard_position,
            vec3.fromValues(scaleX, scaleY, 1),
        );

        return this.#billboard_model_matrix as Float32Array;
    }

    /**
     * Compiles and links the vertex and fragment shaders into a shader program.
     * @param enable_billboard Whether to include billboard calculations in the shader for facing the camera.
     */
    #initShaderProgram({ enable_billboard = true }: { enable_billboard: boolean }): void {
        const gl = this.#context!;
        // Vertex shader
        const vertex_shader_source = `
            attribute vec2 position;
            varying vec2 texCoord;

            ${
                enable_billboard
                    ? `
                uniform mat4 viewMatrix;
                uniform mat4 projectionMatrix;
                uniform vec2 scale;
                uniform mat4 billboardMatrix;`
                    : ""
            }

            uniform vec2 size;
            uniform vec2 offset;
            uniform vec2 viewOffset;

            void main() {
                texCoord = (position + 1.0) * 0.5;
                texCoord.y = 1.0 - texCoord.y;
                texCoord = size * texCoord + offset;
                ${
                    enable_billboard
                        ? `
                gl_Position = projectionMatrix * viewMatrix * billboardMatrix * vec4(position + viewOffset, 0.0, 1.0);`
                        : `
                gl_Position = vec4(position + viewOffset, 0.0, 1.0);`
                }
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
            uniform int fakeAlphaEnabled;
            uniform float fakeAlphaScale;

            float luminance(vec3 color) {
                // sRGB luminance approximation
                return dot(color, vec3(0.299, 0.587, 0.114));
            }

            void main() {
                gl_FragColor = texture2D(texture, texCoord);
                if(fakeAlphaEnabled == 1) {
                    // Use luminance to determine alpha so values close to dark are transparent and smoothly fade
                    // to prevent noise around object's edges
                    float luma = luminance(gl_FragColor.rgb);
                    float alpha = smoothstep(0.02, 0.1, luma);
                    gl_FragColor.a = alpha;

                    // remap [0..1] → [0..fakeAlphaScale] to see through opaque objects in AR
                    if(fakeAlphaScale < 1.0) {
                        gl_FragColor.a *= fakeAlphaScale;
                    }

                    // Premultiply RGB by alpha to avoid color bleeding on transparent edges
                    // (required for correct blending in compositing / XR rendering)
                    gl_FragColor.rgb *= alpha;
                }
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

        // Release shaders as they are no longer needed after linking
        gl.deleteShader(vertex_shader);
        gl.deleteShader(fragment_shader);

        this.#shader_program = shader_program;
    }

    /**
     * Sets up the vertex buffer for a full-screen quad.
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
     * Creates and configures the WebGL texture for frame pixel data.
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

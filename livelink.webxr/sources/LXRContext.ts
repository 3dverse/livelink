//------------------------------------------------------------------------------
import { mat4, quat, vec2, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import type { FrameMetaData, FrameSection, Quat, Vec3 } from "@3dverse/livelink";
import { ContextProvider } from "@3dverse/livelink";

//------------------------------------------------------------------------------
/**
 * Uniforms of the billboard program that the draw call feeds. Their locations are fixed once the
 * program is linked, so they are resolved once in `#initShaderProgram` rather than on every frame.
 */
const UNIFORM_NAMES = [
    "size",
    "offset",
    "viewOffset",
    "viewMatrix",
    "projectionMatrix",
    "billboardMatrix",
    "fakeAlphaEnabled",
    "fakeAlphaScale",
    "vignetteStrength",
    "vignetteScale",
    "texture",
] as const;

//------------------------------------------------------------------------------
/**
 * A uniform of the billboard program. Locations are nullable: uniforms the compiler drops — the
 * billboard matrices when `enable_billboard` is false — resolve to `null`, which the `gl.uniform*`
 * calls then ignore.
 */
type UniformLocations = Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>;

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
     * Uniform locations of {@link #shader_program}, resolved when it is linked. Re-resolved by every
     * {@link initialize}, since a new program invalidates them.
     */
    #uniform_locations: UniformLocations | null = null;

    /**
     * Vertex buffer holding the billboard quad.
     */
    #vertex_buffer: WebGLBuffer | null = null;

    /**
     * Location of the `position` attribute in {@link #shader_program}. Kept so the vertex buffer can
     * be rebound on every draw rather than trusting attribute state to survive between frames.
     */
    #position_attribute_location: number = -1;

    /**
     * Alternative frame buffer to draw on.
     */
    #frame_buffer: WebGLFramebuffer | null = null;

    /**
     * Last drawn frame section, used for rendering and frame metadata.
     */
    #last_frame_section: FrameSection | null = null;

    /**
     * Distance, in XR space metres, at which the billboard is placed in front of the camera.
     *
     * The reprojection it carries is only exact for content sitting on that plane, so it should
     * track the apparent depth of the scene rather than stay fixed: at 1000:1 the content is a
     * kilometre away and at "Fit 1m³" it is at arm's length, and a plane in the wrong place turns
     * head translation into parallax that fights the image — in stereo, a comfort problem as much
     * as a quality one. {@link XRLivelink} keeps it in sync with the camera rig scale each frame;
     * setting it directly only holds until the next frame of an active session.
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
     * Strength of the comfort vignette, from 0 (off) to 1 (the aperture closes to a narrow tunnel).
     *
     * Restricting the periphery during virtual locomotion is the standard countermeasure to the
     * conflict that makes people sick in VR: the optical flow that says "you are moving" is loudest
     * at the edge of the field of view, and that is exactly where the inner ear has nothing to
     * corroborate it with. {@link XRLivelink} raises and lowers this as the user moves; it is not
     * meant to be set per frame by hand.
     */
    vignette_strength: number = 0;

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
     * Whether the program currently linked draws the billboard. Mirrors the argument of the last
     * {@link initialize}, which is re-run on every latency-compensation toggle. Read by
     * {@link drawXRFrame}, which feeds the two paths differently — see the note there.
     */
    #enable_billboard: boolean = true;

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
     *
     * Callable more than once — toggling latency compensation re-initializes the whole pipeline —
     * so it drops the previous GL objects first. Without that, every toggle of a user-facing button
     * leaked a program, a buffer and a texture.
     *
     * @param enable_billboard Whether to include billboard calculations in the shader for facing the camera.
     */
    initialize({ enable_billboard = true }: { enable_billboard?: boolean } = {}): void {
        this.#releaseGLResources();
        this.#enable_billboard = enable_billboard;
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

        // The XR compositor shares this context, so nothing guarantees the program and the vertex
        // attribute state left behind at init are still current. Rebind them rather than inherit
        // whatever the last frame happened to leave bound.
        gl.useProgram(this.#shader_program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertex_buffer);
        gl.enableVertexAttribArray(this.#position_attribute_location);
        gl.vertexAttribPointer(this.#position_attribute_location, 2, gl.FLOAT, false, 0, 0);

        const {
            size: sizeLocation,
            offset: offsetLocation,
            viewMatrix: viewMatrixLocation,
            viewOffset: viewOffsetLocation,
            projectionMatrix: projectionMatrixLocation,
            billboardMatrix: billboardMatrixLocation,
            fakeAlphaEnabled: fakeAlphaEnabledLocation,
            fakeAlphaScale: fakeAlphaScaleLocation,
            vignetteStrength: vignetteStrengthLocation,
            vignetteScale: vignetteScaleLocation,
        } = this.#uniform_locations!;

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

        // Both are the same for every view of the frame.
        gl.uniform1f(vignetteStrengthLocation, this.vignette_strength);
        gl.uniform1f(vignetteScaleLocation, this.scale_factor);

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

            // The off-axis correction belongs to the billboard path only. That quad is a world
            // plane seen through this eye's asymmetric projectionMatrix, which lands its centre at
            // NDC -offset; adding the offset back is what makes it fill [-1, 1] and map the frame
            // onto the eye 1:1. The direct quad never goes through a projection — `position` is
            // already NDC — so the same term is a pure displacement there, and since the offset has
            // opposite signs for the two eyes it pushes their images apart. That is a wrong-signed
            // horizontal disparity across the whole scene, which in a headset reads as the eyes
            // being crossed. Handheld AR never showed it: one view, near-symmetric projection, so
            // the offset is ~0 either way.
            const applies_view_offset = this.#enable_billboard;
            this.#projection_offset[0] = applies_view_offset ? xr_view.projectionMatrix[8] : 0;
            this.#projection_offset[1] = applies_view_offset ? xr_view.projectionMatrix[9] : 0;

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
        this.#releaseGLResources();
    }

    /**
     * Deletes the program, vertex buffer and texture created by {@link initialize}, if any, and
     * forgets everything derived from them. Safe to call on a context that was never initialized.
     */
    #releaseGLResources(): void {
        const gl = this.#context;

        if (this.#texture_ref) {
            gl.deleteTexture(this.#texture_ref);
            this.#texture_ref = null;
        }
        if (this.#vertex_buffer) {
            gl.deleteBuffer(this.#vertex_buffer);
            this.#vertex_buffer = null;
        }
        if (this.#shader_program) {
            gl.deleteProgram(this.#shader_program);
            this.#shader_program = null;
        }

        this.#uniform_locations = null;
        this.#position_attribute_location = -1;
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
            varying vec2 vignetteCoord;

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
            uniform float vignetteScale;

            void main() {
                texCoord = (position + 1.0) * 0.5;
                texCoord.y = 1.0 - texCoord.y;
                texCoord = size * texCoord + offset;
                // Distance from the centre of the view, normalized so 1.0 is the edge of what the
                // user can actually see. With overscan the quad extends past that by the surface
                // scale factor, which is what vignetteScale corrects for — without it the vignette
                // would close in around a ring the user never looks at.
                vignetteCoord = position * vignetteScale;
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
            varying vec2 vignetteCoord;
            uniform sampler2D texture;
            uniform int fakeAlphaEnabled;
            uniform float fakeAlphaScale;
            uniform float vignetteStrength;

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
                }

                if(vignetteStrength > 0.0) {
                    // Comfort vignette: fade the periphery out while the user is moving virtually.
                    // The aperture both narrows and deepens with the strength, so the effect grows
                    // continuously out of "off" rather than popping in at a fixed radius the
                    // instant locomotion starts.
                    float strength = clamp(vignetteStrength, 0.0, 1.0);
                    float outer_radius = mix(1.45, 0.85, strength);
                    float inner_radius = outer_radius * 0.55;
                    float falloff = smoothstep(inner_radius, outer_radius, length(vignetteCoord));
                    gl_FragColor.a *= 1.0 - falloff * strength;
                }

                if(fakeAlphaEnabled == 1) {
                    // Premultiply RGB by alpha to avoid color bleeding on transparent edges
                    // (required for correct blending in compositing / XR rendering).
                    // It has to be the final alpha, not the pre-scale luminance one: the compositor
                    // computes rgb + dst * (1 - a), so premultiplying by more than a adds the
                    // scene on top of an undimmed passthrough instead of fading it into it — the
                    // whole image reads as brighter rather than more transparent.
                    // Which is also why the vignette lands on the alpha above and not here: it has
                    // to be part of the alpha this multiplies by, or the two disagree and the
                    // darkened ring turns into a bright one.
                    gl_FragColor.rgb *= gl_FragColor.a;
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

        // Uniform locations are fixed for the life of a program: resolve them here, once, instead
        // of on every frame of a 72–90 Hz loop.
        this.#uniform_locations = Object.fromEntries(
            UNIFORM_NAMES.map(name => [name, gl.getUniformLocation(shader_program, name)]),
        ) as UniformLocations;
    }

    /**
     * Sets up the vertex buffer for a full-screen quad.
     */
    #initBuffers(): void {
        const gl = this.#context!;

        this.#vertex_buffer = gl.createBuffer();
        const vertices = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this.#position_attribute_location = gl.getAttribLocation(this.#shader_program!, "position");
        gl.enableVertexAttribArray(this.#position_attribute_location);
        gl.vertexAttribPointer(this.#position_attribute_location, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     * Creates and configures the WebGL texture for frame pixel data.
     */
    #initTexture(): void {
        const gl = this.#context!;
        this.#texture_ref = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.#texture_ref);
        // The billboard is essentially never sampled at the resolution it was decoded at — overscan
        // and resolution scaling guarantee it — so NEAREST showed up as per-pixel shimmer crawling
        // over the image on every head movement. LINEAR is safe on the NPOT frame texture as long
        // as no mipmap filter and no repeat wrapping are used, which is the case here.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.uniform1i(this.#uniform_locations!.texture, 0);
    }
}

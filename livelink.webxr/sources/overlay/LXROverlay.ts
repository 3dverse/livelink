//------------------------------------------------------------------------------
import type { LXRContext } from "../LXRContext";
import { LXRFrameErrorLog } from "../LXRFrameLoop";
import type { LXRQuad } from "./LXRQuad";

//------------------------------------------------------------------------------
/**
 * Uniforms of the overlay program, resolved once when it is linked rather than on every frame of a
 * 72–90 Hz loop.
 */
const UNIFORM_NAMES = ["viewMatrix", "projectionMatrix", "modelMatrix", "opacity", "quadTexture"] as const;

//------------------------------------------------------------------------------
/**
 * A uniform of the overlay program.
 */
type UniformLocations = Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>;

//------------------------------------------------------------------------------
/**
 * The unit quad, a triangle strip of top-left, top-right, bottom-left, bottom-right. Spans
 * `[-0.5, 0.5]`, so {@link LXRQuad.width} and {@link LXRQuad.height} are metres rather than
 * half-metres.
 */
const QUAD_VERTICES = new Float32Array([-0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5]);

//------------------------------------------------------------------------------
/**
 * Draws {@link LXRQuad}s into the XR framebuffer, right after the streamed image.
 *
 * This is what makes a user interface possible in a headset at all: `dom-overlay` is optional and
 * no headset browser grants it, so the DOM is composited in a handheld AR session and nowhere else.
 * See {@link XRLivelink.has_dom_overlay}.
 *
 * Three things it has to get right, all of them learned from {@link LXRContext}:
 *
 * - **It binds everything itself.** `drawXRFrame` returns early on a frame with no streamed section,
 *   so the framebuffer binding, the program and the vertex attribute state it leaves behind cannot
 *   be inherited — and the attribute array is disabled again afterwards, so the billboard's own
 *   rebind on the next frame starts from a known state.
 * - **Its output is premultiplied**, `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`. In AR the compositor
 *   computes `rgb + dst * (1 - a)`: colours that are not premultiplied by their final alpha read as
 *   glowing over the passthrough instead of being drawn on it. `drawXRFrame` sets its own blend
 *   function every frame, so changing it here costs nothing.
 * - **No depth test.** UI the streamed image can occlude is unusable, so quads are painted in
 *   {@link LXRQuad.z_order} and nothing else decides what is on top.
 *
 * @experimental
 */
export class LXROverlay {
    /**
     * The rendering context whose GL the quads are drawn with — the same one the streamed image is
     * composited by, since they end up in the same framebuffer.
     */
    readonly #context: LXRContext;

    /**
     * The quads to draw, in registration order. Sorted by {@link LXRQuad.z_order} at draw time.
     */
    readonly #quads: Set<LXRQuad> = new Set();

    /**
     * The quads that are actually drawn this frame, refilled and re-sorted per frame rather than
     * rebuilt, so a display-rate loop allocates nothing.
     */
    readonly #draw_list: LXRQuad[] = [];

    /**
     * Quad space → reference space with {@link LXRQuad.width} and {@link LXRQuad.height} folded in,
     * refilled per quad per frame.
     */
    readonly #model_matrix: Float32Array = new Float32Array(16);

    /**
     * The overlay program, created on the first frame that has something to draw. Lazily, so a
     * consumer that never shows a quad — every VR session before group 7's HUD exists — pays
     * nothing, and so a released overlay simply builds itself again.
     */
    #shader_program: WebGLProgram | null = null;

    /**
     * Uniform locations of {@link #shader_program}, resolved when it is linked.
     */
    #uniform_locations: UniformLocations | null = null;

    /**
     * Vertex buffer holding {@link QUAD_VERTICES}.
     */
    #vertex_buffer: WebGLBuffer | null = null;

    /**
     * Location of the `position` attribute in {@link #shader_program}.
     */
    #position_attribute_location: number = -1;

    /**
     * Whether the program failed to build. Retrying it on every frame would log a compile error
     * ninety times a second and cost a program object each time.
     */
    #is_unavailable: boolean = false;

    /**
     * Deduplicating log for the draw, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * @param context The rendering context the streamed image is drawn with.
     */
    constructor({ context }: { context: LXRContext }) {
        this.#context = context;
    }

    /**
     * The registered quads.
     */
    get quads(): ReadonlySet<LXRQuad> {
        return this.#quads;
    }

    /**
     * Draw a quad from now on, every frame, until it is removed.
     *
     * @param quad The quad to draw. Adding the same one twice has no effect.
     */
    add(quad: LXRQuad): void {
        this.#quads.add(quad);
    }

    /**
     * Stop drawing a quad. Its texture is not released — it is the consumer's.
     *
     * @param quad The quad to remove.
     */
    remove(quad: LXRQuad): void {
        this.#quads.delete(quad);
    }

    /**
     * Stop drawing every quad.
     */
    clear(): void {
        this.#quads.clear();
    }

    /**
     * @internal
     *
     * Draw every visible quad, once per view, immediately after the streamed image.
     *
     * Never throws: an overlay that cannot be drawn is a frame without UI, not a frame without the
     * image the user is actually looking at — and by the time this runs, that image has landed.
     *
     * @param xr_views The views of this frame, in the same order as `xr_viewports`.
     * @param xr_viewports The viewport each view is drawn into.
     * @param frame_buffer The framebuffer the XR layer draws into, or null for the canvas.
     */
    _draw({
        xr_views,
        xr_viewports,
        frame_buffer,
    }: {
        xr_views: readonly XRView[];
        xr_viewports: readonly XRViewport[];
        frame_buffer: WebGLFramebuffer | null;
    }): void {
        try {
            this.#drawQuads({ xr_views, xr_viewports, frame_buffer });
            this.#error_log.reportSuccess();
        } catch (error) {
            this.#error_log.report("Skipped an XR overlay draw", error);
        }
    }

    /**
     * @internal
     *
     * Hand the GPU resources back and forget every quad, for a session that is ending. A consumer
     * that outlives the session re-adds its quads to the next one, the way it re-registers its
     * frame callbacks.
     */
    _release(): void {
        const gl = this.#context.native;

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
        this.#is_unavailable = false;
        this.#quads.clear();
        this.#draw_list.length = 0;
    }

    /**
     * The draw itself. See {@link _draw}, which is what catches what this throws.
     *
     * @param xr_views The views of this frame.
     * @param xr_viewports The viewport each view is drawn into.
     * @param frame_buffer The framebuffer the XR layer draws into.
     */
    #drawQuads({
        xr_views,
        xr_viewports,
        frame_buffer,
    }: {
        xr_views: readonly XRView[];
        xr_viewports: readonly XRViewport[];
        frame_buffer: WebGLFramebuffer | null;
    }): void {
        const draw_list = this.#collectDrawList();
        if (draw_list.length === 0 || xr_views.length === 0) {
            return;
        }
        if (!this.#initGLResources()) {
            return;
        }

        const gl = this.#context.native;
        const {
            viewMatrix: view_matrix_location,
            projectionMatrix: projection_matrix_location,
            modelMatrix: model_matrix_location,
            opacity: opacity_location,
            quadTexture: quad_texture_location,
        } = this.#uniform_locations!;

        gl.bindFramebuffer(gl.FRAMEBUFFER, frame_buffer);

        gl.useProgram(this.#shader_program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertex_buffer);
        gl.enableVertexAttribArray(this.#position_attribute_location);
        gl.vertexAttribPointer(this.#position_attribute_location, 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        // Explicit rather than assumed: the XR compositor shares this context, and `drawXRFrame`
        // never enables the depth test only because nothing it draws needs one.
        gl.disable(gl.DEPTH_TEST);

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(quad_texture_location, 0);

        for (let index = 0; index < xr_views.length; index++) {
            const xr_viewport = xr_viewports[index];
            if (!xr_viewport) {
                continue;
            }

            gl.viewport(xr_viewport.x, xr_viewport.y, xr_viewport.width, xr_viewport.height);
            gl.uniformMatrix4fv(view_matrix_location, false, xr_views[index].transform.inverse.matrix);
            gl.uniformMatrix4fv(projection_matrix_location, false, xr_views[index].projectionMatrix);

            for (const quad of draw_list) {
                // The upload inside happens on the first view only — the texture is clean by the
                // time the second eye asks for it.
                if (!quad.texture!._bind(gl)) {
                    continue;
                }

                gl.uniformMatrix4fv(model_matrix_location, false, this.#composeModelMatrix(quad));
                gl.uniform1f(opacity_location, quad.opacity);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        }

        // The billboard rebinds its own attribute on every frame, but it does so against a location
        // that belongs to *its* program: leaving this one enabled would leave an array pointing at
        // a buffer nothing else knows about.
        gl.disableVertexAttribArray(this.#position_attribute_location);
    }

    /**
     * Refill {@link #draw_list} with the quads that have something to show this frame, painted back
     * to front.
     *
     * @returns The draw list, valid until the next frame.
     */
    #collectDrawList(): LXRQuad[] {
        const draw_list = this.#draw_list;
        draw_list.length = 0;

        for (const quad of this.#quads) {
            if (quad.is_drawable) {
                draw_list.push(quad);
            }
        }

        if (draw_list.length > 1) {
            draw_list.sort((a, b) => a.z_order - b.z_order);
        }
        return draw_list;
    }

    /**
     * Fold a quad's metric size into its pose.
     *
     * The unit quad spans `[-0.5, 0.5]`, so scaling its two in-plane axes is the whole of it: the
     * first two columns of a column-major matrix are exactly those axes, which makes this six
     * multiplications rather than a matrix product.
     *
     * @param quad The quad to compose.
     * @returns A scratch matrix, valid until the next call.
     */
    #composeModelMatrix(quad: LXRQuad): Float32Array {
        const model = this.#model_matrix;
        const { matrix, width, height } = quad;

        for (let i = 0; i < 4; i++) {
            model[i] = matrix[i] * width;
            model[4 + i] = matrix[4 + i] * height;
            model[8 + i] = matrix[8 + i];
            model[12 + i] = matrix[12 + i];
        }
        return model;
    }

    /**
     * Build the program and the vertex buffer if they are not up yet.
     *
     * @returns Whether there is something to draw with.
     */
    #initGLResources(): boolean {
        if (this.#shader_program) {
            return true;
        }
        if (this.#is_unavailable) {
            return false;
        }

        const gl = this.#context.native;

        const vertex_shader = this.#compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fragment_shader = this.#compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        if (!vertex_shader || !fragment_shader) {
            this.#is_unavailable = true;
            return false;
        }

        const shader_program = gl.createProgram();
        if (!shader_program) {
            gl.deleteShader(vertex_shader);
            gl.deleteShader(fragment_shader);
            this.#is_unavailable = true;
            return false;
        }

        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);
        gl.linkProgram(shader_program);
        // Attached shaders are kept alive by the program until it is deleted.
        gl.deleteShader(vertex_shader);
        gl.deleteShader(fragment_shader);

        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.error("XR overlay program failed to link: " + gl.getProgramInfoLog(shader_program));
            gl.deleteProgram(shader_program);
            this.#is_unavailable = true;
            return false;
        }

        this.#shader_program = shader_program;
        this.#uniform_locations = Object.fromEntries(
            UNIFORM_NAMES.map(name => [name, gl.getUniformLocation(shader_program, name)]),
        ) as UniformLocations;
        this.#position_attribute_location = gl.getAttribLocation(shader_program, "position");

        this.#vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

        return true;
    }

    /**
     * Compile one shader.
     *
     * @param type `VERTEX_SHADER` or `FRAGMENT_SHADER`.
     * @param source The GLSL source.
     * @returns The shader, or null when it did not compile.
     */
    #compileShader(type: GLenum, source: string): WebGLShader | null {
        const gl = this.#context.native;

        const shader = gl.createShader(type);
        if (!shader) {
            return null;
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("XR overlay shader failed to compile: " + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}

//------------------------------------------------------------------------------
const VERTEX_SHADER_SOURCE = `
    attribute vec2 position;
    varying vec2 texCoord;

    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    uniform mat4 modelMatrix;

    void main() {
        // Quad space has y up, a canvas has y down.
        texCoord = vec2(position.x + 0.5, 0.5 - position.y);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 0.0, 1.0);
    }`;

//------------------------------------------------------------------------------
const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;
    varying vec2 texCoord;
    uniform sampler2D quadTexture;
    uniform float opacity;

    void main() {
        // The texture was uploaded premultiplied, so the opacity scales colour and alpha alike —
        // that is what premultiplied means, and it is what the blend function expects.
        gl_FragColor = texture2D(quadTexture, texCoord) * opacity;
    }`;

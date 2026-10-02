//------------------------------------------------------------------------------
import { OffscreenSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LXRContext } from "./LXRContext";
import { LXRSession } from "./LXRSession";

//------------------------------------------------------------------------------
/**
 * Largest frame dimension, in pixels, the remote renderer is assumed able to deliver. 4096 is the
 * width and height ceiling of the common H.264 and HEVC hardware encode levels, and a request past
 * it comes back as a frame of the renderer's own size instead — which used to blank the stream and
 * now merely costs resolution. See {@link LXRSurface.max_remote_frame_dimension}.
 */
const LXR_DEFAULT_MAX_REMOTE_FRAME_DIMENSION = 4096;

/**
 * Room left for the macroblock rounding the remote frame proxy applies on top of a requested size.
 * One HEVC macroblock covers the worst case.
 */
const MACROBLOCK_SLACK = 64;

//------------------------------------------------------------------------------
// TODO: may not be relevant class => XRLivelink if no other clear responsability
/**
 * Manages WebXR rendering configuration following Single Responsibility Principle.
 * Responsible for:
 * - Surface management
 * - Resolution scaling
 * - Overscan configuration
 * - Latency compensation
 * - Render state updates
 *
 * @experimental
 */
export class LXRSurface extends OffscreenSurface<"webgl", WebGLContextAttributes & { xrCompatible: boolean }> {
    /**
     * Reference to the WebXR session manager for accessing session information when configuring the surface.
     */
    readonly #session: LXRSession;

    /**
     * Size of the XR framebuffer, as reported by the base layer. Kept because the offscreen canvas
     * carries it scaled, and {@link clampSurfaceScale} needs the unscaled value.
     */
    #framebuffer_size: [number, number] = [0, 0];

    /**
     * Largest frame dimension the remote renderer is expected to be able to deliver. Overscan asks
     * for 1.5x the framebuffer in each direction, which on a stereo headset is enough to cross an
     * encoder's ceiling; the scale is clamped to stay inside this instead. Lower it for a renderer
     * or a connection with a tighter limit.
     */
    max_remote_frame_dimension: number = LXR_DEFAULT_MAX_REMOTE_FRAME_DIMENSION;

    /**
     * Constructor for LXRSurface.
     *
     * @param session Reference to the WebXR session manager.
     */
    constructor(session: LXRSession) {
        super({
            width: window.innerWidth,
            height: window.innerHeight,
            context_constructor: LXRContext,
            context_type: "webgl",
            // `antialias: false` because this canvas is never displayed: every draw goes to the XR
            // framebuffer, so multisampling its drawing buffer only has the user agent allocate a
            // full stereo resolution MSAA target that nothing ever samples.
            context_attributes: { xrCompatible: true, antialias: false },
        });
        this.#session = session;
    }

    /**
     * Get the XR rendering context
     */
    get context(): LXRContext {
        // TODO: something is wrong about getContext() typing it uses context_type but it is the inner (webgl) context
        // of the LXContext. Same implementation quirk exists for the regular RenderingSurface implementation.
        return this.getContext();
    }

    /**
     * Get the XRWebGLLayer used as the base layer for the XR session. This layer is created and managed by the
     * XRSession and is used for rendering the XR views. It provides information about the framebuffer and viewport
     * configuration for rendering.
     */
    get xr_base_gl_layer(): XRWebGLLayer | undefined {
        return this.#session.native?.renderState.baseLayer;
    }

    /**
     * Get the current surface scale factor, which is applied to the XR rendering. This scale factor is used to adjust
     * the effective resolution of the XR surface for performance optimization, overscan rendering, and latency compensation.
     * It is applied on top of the resolution scale and any overscan scaling.
     */
    get scale_factor(): number {
        return this.context.scale_factor;
    }

    /**
     * Set the surface scale factor, which is applied to the XR rendering. This scale factor is used to adjust the effective
     * resolution of the XR surface for performance optimization, overscan rendering, and latency compensation. It is applied
     * on top of the resolution scale and any overscan scaling.
     */
    set scale_factor(value: number) {
        this.context.scale_factor = value;
    }

    /**
     * Get fake alpha mode flag of the LXRContext
     */
    get enable_fake_alpha(): boolean {
        return this.context.fake_alpha_enabled;
    }

    /**
     * Set fake alpha mode flag of the LXRContext
     */
    set enable_fake_alpha(value: boolean) {
        this.context.fake_alpha_enabled = value;
    }

    /**
     * Get fake alpha scale value
     */
    get fake_alpha_scale(): number {
        return this.context.fake_alpha_scale;
    }

    /**
     * Set fake alpha scale value
     */
    set fake_alpha_scale(value: number) {
        if (value < 0 || value > 1) {
            throw new Error("Fake alpha scale must be between 0 and 1");
        }
        this.context.fake_alpha_scale = value;
    }

    /**
     * Configure the XR surface for a given XR view and perspective lens. This involves setting the appropriate
     * resolution scale, overscan configuration, and any other parameters needed to ensure optimal rendering for the XR view.
     *
     * @param session Active XR session, used to update render state if needed during configuration changes
     * @param is_ar Whether the session is an AR session, which may require different configuration (e.g. fake alpha)
     */
    public async initialize({
        session,
        is_ar,
    }: {
        session: XRSession;
        is_ar: boolean;
    }): Promise<ReadonlyArray<XRView>> {
        console.debug("Initializing LXRSurface with configuration:", { session, is_ar });

        // Check for abort signal before proceeding with potentially expensive initialization
        await this.updateRenderState(session);

        // Get XR views from first XRFrame to configure
        console.debug("Waiting for first XR frame to get XR views for configuration...");
        const xr_views = await this.#session.getXRViews();
        if (xr_views.length > 2) {
            throw new Error(`Unsupported number of XR views: ${xr_views.length}. Maximum supported is 2.`);
        }

        this.enable_fake_alpha = is_ar;

        return xr_views;
    }

    /**
     * Update the XR session render state
     *
     * @param session Active XR session
     * @param layer_init Optional WebGL layer initialization options
     */
    public async updateRenderState(session: XRSession, layer_init: XRWebGLLayerInit = {}): Promise<XRWebGLLayer> {
        // `antialias` defaults to true per spec, and on a headset the user agent honours that with a
        // multisampled target the size of both eyes. What gets drawn into it is one textured quad
        // per eye plus the overlay's quads, so the only thing multisampling buys is marginally
        // smoother overlay panel edges, at a cost in fill rate a mobile GPU feels. A consumer that
        // wants it back passes `{ antialias: true }` through `XRLivelink.updateRenderState`.
        const baseLayer = new XRWebGLLayer(session, this.context.native, { antialias: false, ...layer_init });
        await session.updateRenderState({ baseLayer });
        // The framebuffer deliberately is not cached on the context: the draw is handed the live
        // layer's one every frame, the way the overlay already was, so the two cannot disagree about
        // which framebuffer the frame belongs to.
        this.#framebuffer_size = [baseLayer.framebufferWidth, baseLayer.framebufferHeight];
        this.resize(baseLayer.framebufferWidth, baseLayer.framebufferHeight);
        return baseLayer;
    }

    /**
     * The given scale, brought down to what the remote renderer can be expected to deliver.
     *
     * The surface scale multiplies the size requested from the renderer, so overscan at 1.5 asks for
     * 2.25x the pixels of the XR framebuffer. On a stereo headset that crosses the encoder's
     * dimension ceiling, and a request the renderer declines comes back as a frame of a different
     * size — which costs resolution at best. Clamping keeps the request deliverable, and because
     * only the pixel density changes the image stays geometrically correct, just softer.
     *
     * @param scale The desired surface scale.
     * @returns The desired scale, or the largest deliverable one if that is smaller.
     */
    public clampSurfaceScale(scale: number): number {
        const largest_dimension = Math.max(this.#framebuffer_size[0], this.#framebuffer_size[1]);
        if (largest_dimension === 0) {
            // No base layer yet, so there is no framebuffer size to clamp against.
            return scale;
        }

        const max_scale = (this.max_remote_frame_dimension - MACROBLOCK_SLACK) / largest_dimension;
        return Math.min(scale, max_scale);
    }
}

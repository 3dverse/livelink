//------------------------------------------------------------------------------
import { OffscreenSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LXRContext } from "./LXRContext";
import { LXRSession } from "./LXRSession";

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
export class LXRSurface extends OffscreenSurface<"webgl", { xrCompatible: boolean }> {
    /**
     * Reference to the WebXR session manager for accessing session information when configuring the surface.
     */
    readonly #session: LXRSession;

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
            context_attributes: { xrCompatible: true },
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
        const baseLayer = new XRWebGLLayer(session, this.context.native, layer_init);
        await session.updateRenderState({ baseLayer });
        this.context.frame_buffer = baseLayer.framebuffer;
        this.resize(baseLayer.framebufferWidth, baseLayer.framebufferHeight);
        return baseLayer;
    }
}

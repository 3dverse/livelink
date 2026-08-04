//------------------------------------------------------------------------------
import type { Livelink, Viewport, Transform, Components } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LXRSession } from "./LXRSession";
import { LXRSurface } from "./LXRSurface";
import { LXRCameraRig } from "./LXRCameraRig";
import { LXRViewport } from "./LXRViewport";
import { TypedEventTarget } from "./utils/TypedEventTarget";
import { type LXREvents, SessionEndEvent, ViewportUpdatedEvent } from "./LXREvents";
import { Quaternion, Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
/**
 * Main Livelink WebXR integration facade orchestrating session management, display config, viewports, and cameras.
 * - LXRSession: XRSession lifecycle
 * - LXRSurface: WebGL layer and display parameters
 * - LXRViewport: Viewport management and XR view mapping
 * - LXRCameraRig: Transform composition and virtual movement
 *
 * @experimental
 */
export class XRLivelink extends TypedEventTarget<LXREvents> {
    /**
     * Reference to the main Livelink instance for accessing scene, viewports, and other shared resources.
     */
    readonly #livelink: Livelink;

    /**
     * WebXR session manager handling session lifecycle, reference space, and session state.
     */
    readonly #session: LXRSession;

    /**
     * Rendering surface manager handling WebGL layer configuration, resolution scaling, and display parameters.
     */
    readonly #surface: LXRSurface;

    /**
     * Camera rig managing XR device pose and virtual movement.
     */
    readonly #camera_rig: LXRCameraRig;

    /**
     * Map of XR eyes to LXRViewports, which combine XR view data with livelink viewport configuration for rendering.
     */
    readonly #lxr_viewports: Map<XREye, LXRViewport> = new Map();

    /**
     * Animation frame request ID for managing the XR frame loop.
     */
    #animation_frame_request_id: number = 0;

    /**
     * Whether the XR frame loop should keep re-arming itself. Lowered by {@link stop} so that a
     * callback already queued when the loop was stopped — every frame in flight when the session
     * ends — does not queue another one.
     */
    #is_frame_loop_running: boolean = false;

    /**
     * Message of the last error caught in {@link #onXRFrame}, or undefined if the last frame
     * succeeded. A failing frame usually fails again on the next one, so only transitions are
     * logged rather than every frame of a 72–90 Hz loop.
     */
    #last_frame_error_message?: string;

    /**
     * Whether latency compensation using billboard rendering is enabled.
     * This affects overscan configuration and FOV adjustments.
     */
    #enable_latency_compensation: boolean = true;

    /**
     * Whether overscan rendering is enabled. Overscan renders a larger view to compensate for latency and provide
     * better edge coverage during head movement. Used in combination with latency compensation.
     */
    #enable_overscan: boolean = false;

    /**
     * Overscan FOV factor determines how much the field of view is increased when overscan is enabled.
     * A factor of 1.5 means a 50% increase in FOV.
     */
    #overscan_fov_factor: number = 1.5;

    /**
     * Overridden FOV Y value in degrees when latency compensation is enabled. This is computed from the original
     * FOV and overscan factor.
     */
    #overridden_fovy?: number;

    /**
     * Overridden near plane value, useful for WebXR emulators that may have unrealistic near plane distances.
     * If set, this value will be used instead of the one computed from the projection matrix.
     */
    #overridden_near_plane?: number;

    /**
     * Resolution scale factor for the XR surface. This is applied on top of any overscan scaling.
     */
    #resolution_scale: number = 1.0;

    /**
     * Whether {@link release} has been entered. Set before the session is ended so that the `end`
     * event it triggers can be told apart from an end initiated by the system or the user, which
     * is the only one consumers should react to. See {@link SessionEndEvent}.
     */
    #is_releasing: boolean = false;

    /**
     * Test if the provided XR session mode is supported by this browser.
     */
    public static async isSessionSupported(mode: XRSessionMode): Promise<boolean> {
        return LXRSession.isSessionSupported(mode);
    }

    /**
     * Constructor for XRLivelink.
     *
     * @param livelink The main Livelink instance to integrate with.
     */
    constructor(livelink: Livelink) {
        super();
        this.#livelink = livelink;
        this.#session = new LXRSession();
        this.#surface = new LXRSurface(this.#session);
        this.#camera_rig = new LXRCameraRig(livelink.scene);
    }

    /**
     * The active XRSession
     */
    get xr_session(): XRSession | undefined {
        return this.#session.native;
    }

    /**
     * The XRSessionMode
     */
    get xr_mode(): XRSessionMode {
        return this.#session.xr_mode;
    }

    /**
     * Whether {@link release} has been entered. Any XRSession `end` observed from now on is one we
     * asked for, not one the user or the system initiated.
     */
    get is_releasing(): boolean {
        return this.#is_releasing;
    }

    /**
     * The XRReferenceSpace
     */
    get xr_reference_space(): XRReferenceSpace | undefined {
        return this.#session.reference_space;
    }

    /**
     * The configured livelink eyes combining XR and Livelink viewport data
     */
    get lxr_viewports(): Map<XREye, LXRViewport> {
        return this.#lxr_viewports;
    }

    /**
     * The configured livelink viewports
     */
    get viewports(): Viewport[] {
        return Array.from(this.#lxr_viewports.values()).map(({ viewport }) => viewport);
    }

    /**
     * True if exactly 2 XR viewports are configured (stereo vision)
     */
    get is_stereo_vision(): boolean {
        return this.#lxr_viewports.size === 2;
    }

    /**
     * The resolution scale factor for XR rendering. This scales the resolution of the billboard to balance
     * performance and visual quality.
     */
    get resolution_scale(): number {
        return this.#resolution_scale;
    }

    /**
     * Set the resolution scale factor for XR rendering. This scales the resolution of the billboard to balance
     * performance and visual quality.
     */
    set resolution_scale(value: number) {
        this.#resolution_scale = value;
        this.#updateSurfaceScale();
    }

    /**
     * Whether to enable the fake alpha for AR sessions. It blends the XRWebGLLayer with a real world background
     * (device camera) to approximate alpha blending based on FTL frame pixel luminance.
     */
    get enable_fake_alpha(): boolean {
        return this.#surface.enable_fake_alpha;
    }

    /**
     * Enable fake alpha for AR sessions.  It blends the XRWebGLLayer with a real world background
     * (device camera) to approximate alpha blending based on FTL frame pixel luminance.
     */
    set enable_fake_alpha(value: boolean) {
        this.#surface.enable_fake_alpha = value;
    }

    /**
     * The fake alpha scale value used to adjust the strength of the fake alpha effect. A value of 0 means no fake
     * alpha effect, while a value of 1 means full fake alpha effect based on the FTL frame pixel luminance.
     */
    get fake_alpha_scale(): number {
        return this.#surface.fake_alpha_scale;
    }

    /**
     * Set the fake alpha scale value used to adjust the strength of the fake alpha effect. A value of 0 means no fake ,
     * alpha effect while a value of 1 means full fake alpha effect based on the FTL frame pixel luminance.
     */
    set fake_alpha_scale(value: number) {
        this.#surface.fake_alpha_scale = value;
    }

    /**
     * Wheter to enable overscan configuration for XR sessions billboard. This enlarges billboard rendering to hide the
     * billboard position latency to the user by adding padding to the XRWebGLLayer.
     */
    get enable_overscan(): boolean {
        return this.#enable_overscan;
    }

    /**
     * Enable overscan configuration for XR sessions billboard. This enlarges billboard rendering to hide the
     * billboard position latency to the user by adding padding to the XRWebGLLayer.
     */
    set enable_overscan(value: boolean) {
        if (this.#enable_overscan === value) {
            return;
        }

        this.#enable_overscan = value;
        this.#reconfigureOverscan();
    }

    /**
     * Whether to enable latency compensation for XR sessions. This enables the billboard to compensate the latency
     * of the FTL frame rendering against the current device pose.
     */
    get enable_latency_compensation(): boolean {
        return this.#enable_latency_compensation;
    }

    /**
     * Enable latency compensation for XR sessions. This enables the billboard to compensate the latency
     * of the FTL frame rendering against the current device pose.
     */
    set enable_latency_compensation(value: boolean) {
        if (this.#enable_latency_compensation === value) {
            return;
        }

        this.#enable_latency_compensation = value;
        this.#surface.context.initialize({ enable_billboard: this.#enable_latency_compensation });
        this.#reconfigureOverscan();
    }

    /**
     * Get overscan FOV factor
     */
    get overscan_fov_factor(): number {
        return this.#overscan_fov_factor;
    }

    /**
     * Set overscan FOV factor
     */
    set overscan_fov_factor(value: number) {
        this.#overscan_fov_factor = value;
        this.#updateSurfaceScale();
    }

    /**
     * Get overridden near plane value
     */
    get overriden_near_plane(): number | undefined {
        return this.#overridden_near_plane;
    }

    /**
     * Set overridden near plane value (useful for WebXR emulator)
     */
    set overriden_near_plane(value: number | undefined) {
        this.#overridden_near_plane = value;
    }

    /**
     * Get overridden FOV Y value
     */
    get overridden_fovy(): number | undefined {
        return this.#overridden_fovy;
    }

    /**
     * Access camera rig for virtual movement control.
     */
    get camera_rig(): LXRCameraRig {
        return this.#camera_rig;
    }

    /**
     * Access the active XRSession. Throws an error if no session is active.
     */
    get #xr_session(): XRSession {
        const { native: native_session } = this.#session;
        if (!native_session) {
            throw new Error("No active XR session to start");
        }
        return native_session;
    }

    /**
     * Access the active XRReferenceSpace. Throws an error if no session or reference space is active.
     */
    get #xr_reference_space(): XRReferenceSpace {
        const { reference_space } = this.#session;
        if (!reference_space) {
            throw new Error("No XR reference space");
        }
        return reference_space;
    }

    /**
     * Access the active XRWebGLLayer. Throws an error if no session or XRWebGLLayer is active.
     */
    get #base_gl_layer(): XRWebGLLayer {
        const gl_layer = this.#session.native?.renderState.baseLayer;
        if (!gl_layer) {
            throw new Error("No active XRWebGLLayer");
        }
        return gl_layer;
    }

    /**
     * Helper method to check abort signal and throw standardized abort error if aborted.
     */
    #throwIfAborted(signal: AbortSignal | undefined, operation: string = "initialization"): void {
        if (signal?.aborted) {
            throw new DOMException(`XRLivelink ${operation} aborted`, "AbortError");
        }
    }

    /**
     * Initialize the XRSession.
     *
     * @param mode The XR session mode
     * @param xr_session_init Optional XRSessionInit parameters
     * @param force_single_view Whether to force single view rendering (mono instead of stereo)
     * @param origin_transform Optional initial transform for the XR origin
     * @param preserve_initial_orientation Whether to preserve the initial XR device orientation as the origin forward direction
     * @param signal Optional abort signal to cancel initialization
     * @returns Promise resolving to the XRSession
     */
    public async initialize({
        mode,
        xr_session_init = {},
        force_single_view: force_single_view = false,
        origin_transform,
        preserve_initial_orientation,
        signal,
    }: {
        mode: XRSessionMode;
        xr_session_init?: XRSessionInit;
        force_single_view?: boolean;
        origin_transform?: Partial<Transform>;
        preserve_initial_orientation?: boolean;
        signal?: AbortSignal;
    }): Promise<XRSession> {
        const is_ar = mode === "immersive-ar";

        // A previously released instance being initialized again starts a new session, whose end is
        // once more something consumers need to hear about.
        this.#is_releasing = false;

        // Initialize XR session
        const session = await this.#session.initialize({
            mode,
            xr_session_init,
            force_single_view,
            signal,
        });

        // Listen for the session ending as early as possible: the rest of this method can take
        // several seconds (surface, viewports, camera rig), and a session ended in that window
        // would otherwise never be reported — leaving the consumer waiting on an initialization
        // that can no longer complete.
        session.addEventListener("end", this.#onXRSessionEnd);

        this.#throwIfAborted(signal);

        // Configure XRWebGLLayer and display parameters
        const xr_views = await this.#surface.initialize({ session, is_ar });
        this.#throwIfAborted(signal);

        // Configure overscan after surface initialization
        this.#configureOverscan({
            xr_views,
        });

        // Initialize viewports and cameras for each XR view
        for (const xr_view of xr_views) {
            await this.#initializeViewport({ xr_view, is_ar });
            this.#throwIfAborted(signal, "viewport configuration");
        }

        // Initialize camera rig with origin at initial center eye position
        await this.#camera_rig.initialize({
            origin_transform,
            xr_views,
            lxr_viewports: this.#lxr_viewports,
            preserve_initial_orientation,
        });
        this.#throwIfAborted(signal, "viewport configuration");

        // Add viewports to livelink after they have been configured
        this.#livelink.addViewports({ viewports: this.viewports });

        console.debug("XRLivelink configured successfully");
        return session;
    }

    /**
     * Initialize an LXRViewport for the given XRView and attach its camera to the rig. This configures the viewport
     * with the XR view's projection matrix and creates a camera entity parented to the rig's pose entity.
     *
     * @param xr_view The XR view for which to initialize the viewport and camera.
     * @param is_ar Whether the session is an AR session, which may require different viewport configuration.
     */
    async #initializeViewport({ xr_view, is_ar }: { xr_view: XRView; is_ar: boolean }): Promise<void> {
        const perspective_lens = this.#computePerspectiveLens(xr_view.projectionMatrix);

        const lxrv = await LXRViewport.create({
            livelink: this.#livelink,
            xr_view,
            rendering_surface: this.#surface,
            is_ar,
            perspective_lens,
        });
        this.#lxr_viewports.set(xr_view.eye, lxrv);
    }

    /**
     * Sets the reference space type
     */
    public async setReferenceSpaceType(type: XRReferenceSpaceType = "local"): Promise<XRReferenceSpace> {
        return this.#session.setReferenceSpaceType(type);
    }

    /**
     * Update the XR session render state
     */
    public async updateRenderState(layer_init: XRWebGLLayerInit = {}): Promise<void> {
        await this.#surface.updateRenderState(this.#xr_session, layer_init);
    }

    /**
     * Start the XR frame animation loop
     */
    public start(): void {
        this.#is_frame_loop_running = true;
        this.#animation_frame_request_id = this.#xr_session.requestAnimationFrame(this.#onXRFrame);
    }

    /**
     * Stop the XR frame animation loop
     */
    public stop(): void {
        this.#is_frame_loop_running = false;

        if (this.#animation_frame_request_id && this.xr_session) {
            try {
                this.xr_session.cancelAnimationFrame(this.#animation_frame_request_id);
            } catch (error) {
                // Cancelling on an already ended session throws in some UAs. The loop is dead
                // either way, so this must not prevent the rest of the teardown from running.
                console.warn("Could not cancel the XR animation frame:", error);
            }
            this.#animation_frame_request_id = 0;
        }
    }

    /**
     * Handle the XRSession ending. Ends we caused ourselves through {@link release} are swallowed;
     * everything else — system menu, back gesture, doff timeout — is forwarded to consumers, which
     * is their only chance to leave the XR mode they optimistically entered.
     */
    #onXRSessionEnd = (event: XRSessionEvent): void => {
        this.stop();

        if (this.#is_releasing) {
            return;
        }

        console.debug("XR session ended externally");
        this._dispatchEvent(new SessionEndEvent({ xr_session_event: event }));
    };

    /**
     * XR frame callback. Drives the frame and then re-arms the loop, whatever the frame did.
     *
     * A frame is allowed to fail. The session is still alive when it does, so a loop that stopped
     * re-arming would leave the user staring at the last frame ever drawn, rigidly following their
     * head with no way out but a page reload. Skipping a frame is recoverable; dying is not.
     *
     * @param _ The high resolution timestamp for the current frame, which can be used for synchronizing animations or other time-based updates.
     * @param frame The XRFrame containing the latest pose and view data from the XR session, which is used to update the viewports and render the frame.
     */
    #onXRFrame = (_: DOMHighResTimeStamp, frame: XRFrame): void => {
        try {
            this.#renderXRFrame(frame);
            this.#last_frame_error_message = undefined;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message !== this.#last_frame_error_message) {
                this.#last_frame_error_message = message;
                console.error("Skipped an XR frame:", error);
            }
        }

        this.#requestNextXRFrame();
    };

    /**
     * Re-arm the XR frame loop, unless it has been stopped in the meantime — which is the case for
     * any frame still in flight when the session ended.
     */
    #requestNextXRFrame(): void {
        const session = this.#session.native;
        if (!this.#is_frame_loop_running || !session) {
            return;
        }

        this.#animation_frame_request_id = session.requestAnimationFrame(this.#onXRFrame);
    }

    /**
     * Render a single XR frame: update the viewports and camera rig from the current viewer pose,
     * then draw. May throw; see {@link #onXRFrame}.
     *
     * @param frame The XRFrame containing the latest pose and view data from the XR session.
     */
    #renderXRFrame(frame: XRFrame): void {
        const reference_space = this.#xr_reference_space;
        const gl_layer = this.#base_gl_layer;

        // Get viewer pose
        const pose = frame.getViewerPose(reference_space);
        if (!pose) {
            return;
        }

        // Filter the XR views to only those that have corresponding viewports (e.g. in case of more than 2 views,
        // or views for which we failed to initialize a viewport, or force_single_view mode which only initializes a
        // viewport for the first view)
        const xr_views = pose.views.filter(xr_view => this.#lxr_viewports.has(xr_view.eye));

        // Compute center eye position for camera IPD offset calculations
        this.#camera_rig.updateXrSpaceCenterEye(xr_views);

        // Update each viewport with latest XR view data
        const lxr_viewports: LXRViewport[] = [];
        for (const xr_view of xr_views) {
            const lxr_viewport = this.#getLXRViewportByEye(xr_view.eye);
            this.#updateViewport({ xr_view, lxr_viewport, gl_layer, center_eye: this.#camera_rig.xr_space_center_eye });
            lxr_viewports.push(lxr_viewport);
        }

        // Update camera rig with latest center eye position and remote camera transforms for this frame.
        // The rig uses this data to compute the final camera transforms for the viewports, which may include virtual
        // movement offsets and/or latency compensation adjustments.
        const remote_camera_transforms = lxr_viewports.map(lxrv => lxrv.getCameraRemoteTransform());
        this.#camera_rig.update({ remote_camera_transforms });

        // Draw the frame for each viewport with the latest XR view and remote camera transform data
        this.#surface.context.drawXRFrame({
            xr_views,
            xr_viewports: lxr_viewports.map(lxr_viewport => lxr_viewport.xr_viewport),
            frame_camera_transforms: remote_camera_transforms,
        });
    }

    /**
     * Get the LXRViewport corresponding to the given XR eye. Throws an error if no viewport is found for the eye.
     *
     * @param eye The XR eye ("left" or "right") for which to get the LXRViewport
     * @returns The LXRViewport corresponding to the given XR eye
     */
    #getLXRViewportByEye(eye: XREye): LXRViewport {
        const lxr_viewport = this.#lxr_viewports.get(eye);
        if (!lxr_viewport) {
            throw new Error(`LXRViewport not found for eye ${eye}`);
        }
        return lxr_viewport;
    }

    /**
     * Update the LXRViewport configuration based on the latest XRView data for the current frame. This ensures that the
     * viewport camera remains synchronized with the XR device's movements and the current view configuration.
     * It also uses the XR view's projection matrix to update the camera's perspective lens if needed.
     *
     * @param xr_view The XR view containing the current transform and lens information for the camera.
     * @param lxr_viewport The LXRViewport to update based on the XR view data.
     * @param gl_layer The XRWebGLLayer to reconcile the viewport rect against for the current frame.
     * @param center_eye The position of the center eye, used to compute the IPD offset for the camera's local transform.
     */
    #updateViewport({
        xr_view,
        lxr_viewport,
        gl_layer,
        center_eye,
    }: {
        xr_view: XRView;
        lxr_viewport: LXRViewport;
        gl_layer: XRWebGLLayer;
        center_eye: { position: Vector3; orientation: Quaternion; orientation_conjugate: Quaternion };
    }): void {
        // Reconcile the LXRViewport with the current XRView and XRWebGLLayer configuration. The user
        // agent may resize the viewport on any frame, dynamic viewport scaling being the whole point
        // of `requestViewportScale`, so this reconfigures the viewport instead of failing.
        let is_viewport_updated = lxr_viewport.syncViewportRect({ xr_view, gl_layer });

        // Update the viewport's camera with the latest XR view data and center eye position for IPD offset
        const camera = lxr_viewport.updateCamera({
            xr_view,
            center_eye_position: center_eye.position,
            center_eye_orientation_conjugate: center_eye.orientation_conjugate,
        });

        // Update perspective lens if needed
        const perspective_lens = this.#computePerspectiveLens(xr_view.projectionMatrix);
        if (!camera.perspective_lens || this.#areDistinctLens(perspective_lens, camera.perspective_lens)) {
            console.debug(`🔍 Updating perspective lens for camera ${camera.name}`, perspective_lens);
            camera.perspective_lens = perspective_lens;
            is_viewport_updated = true;
        }

        // A rect change and a lens change usually arrive together — notify consumers once.
        if (is_viewport_updated) {
            this._dispatchEvent(new ViewportUpdatedEvent({ viewport: lxr_viewport.viewport }));
        }
    }

    /**
     * Compute perspective lens parameters from projection matrix
     *
     * @param projectionMatrix XR view projection matrix
     * @returns Perspective lens parameters
     */
    #computePerspectiveLens(projectionMatrix: Float32Array): Components.PerspectiveLens {
        const scale = this.#camera_rig.scale;

        const fovy =
            (this.#enable_latency_compensation ? this.#overridden_fovy : null) ??
            Math.atan(1 / projectionMatrix[5]) * (180 / Math.PI) * 2;

        let near_plane = projectionMatrix[14] / (projectionMatrix[10] - 1);
        if (scale !== undefined && scale !== 1) {
            near_plane *= 1 / scale;
        }

        const far_plane = projectionMatrix[14] / (projectionMatrix[10] + 1);
        const offset = [projectionMatrix[8], projectionMatrix[9] * -1] as [number, number];

        return {
            fovy,
            nearPlane: this.#overridden_near_plane || near_plane,
            farPlane: far_plane,
            offset,
        };
    }

    /**
     * Utility function to compare perspective lens components for differences.
     */
    #areDistinctLens(lensA: Components.PerspectiveLens, lensB: Components.PerspectiveLens): boolean {
        return (
            lensA.fovy !== lensB.fovy ||
            lensA.nearPlane !== lensB.nearPlane ||
            lensA.farPlane !== lensB.farPlane ||
            lensA.offset.some((v, i) => v !== lensB.offset[i])
        );
    }

    /**
     * Configure overscan based on XR views
     *
     * @param xr_views XR views to compute overscan from
     * @returns overridden_fovy if computed, undefined otherwise
     */
    #configureOverscan({ xr_views }: { xr_views: Readonly<Array<XRView>> }): void {
        this.#updateSurfaceScale();

        if (!this.#enable_overscan || !this.#enable_latency_compensation) {
            this.#overridden_fovy = undefined;
            return;
        }

        const fovY = xr_views[0].projectionMatrix[5];
        const original_fov = 2 * Math.atan(1 / fovY);
        const new_fov = 2 * Math.atan(Math.tan(original_fov / 2) * this.#overscan_fov_factor);
        this.#overridden_fovy = new_fov * (180 / Math.PI);

        console.debug(
            `%cFOV: ${original_fov * (180 / Math.PI)} -> ${this.#overridden_fovy}, scale factor: ${this.#surface.scale_factor}, resolution scale: ${this.#resolution_scale}, final surface scale: ${this.#surface.scale}`,
            "color: orange; font-weight: bold; font-size: 1.5em",
        );
    }

    /**
     * Update the surface scale based on the current overscan and latency compensation settings. This is called whenever
     * the overscan or latency compensation settings are changed to ensure the surface scale is correctly updated.
     */
    #updateSurfaceScale(): void {
        if (this.#enable_overscan && this.#enable_latency_compensation) {
            this.#surface.scale = this.#resolution_scale * this.#overscan_fov_factor;
            this.#surface.scale_factor = this.#overscan_fov_factor;
        } else {
            this.#surface.scale = this.#resolution_scale;
            this.#surface.scale_factor = 1;
        }
    }

    /**
     * Reconfigure overscan settings
     */
    async #reconfigureOverscan(): Promise<void> {
        const xr_views = await this.#session.getXRViews();
        this.#configureOverscan({ xr_views });
    }

    /**
     * Release all resources and end the session
     */
    public async release(): Promise<void> {
        // Raised before anything else so that the `end` event ultimately triggered by
        // `#session.release()` is recognised as ours and not forwarded as a SessionEndEvent.
        this.#is_releasing = true;

        this.stop();
        this.xr_session?.removeEventListener("end", this.#onXRSessionEnd);

        this.#lxr_viewports.forEach(lxr_viewport => lxr_viewport.release());
        this.#lxr_viewports.clear();
        this.#surface.release();

        await Promise.all([this.#camera_rig.release(), this.#session.release()]);
    }
}

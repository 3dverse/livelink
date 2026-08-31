//------------------------------------------------------------------------------
import type { Livelink, Viewport, Transform, Components } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LXRSession } from "./LXRSession";
import { LXRSurface } from "./LXRSurface";
import { LXRCameraRig } from "./LXRCameraRig";
import { LXRViewport } from "./LXRViewport";
import { TypedEventTarget } from "./utils/TypedEventTarget";
import { type LXREvents, SessionEndEvent, ViewportUpdatedEvent } from "./LXREvents";
import { LXR_DEFAULT_COMFORT_VIGNETTE_STRENGTH, defaultTurnModeForSessionMode } from "./LXRComfort";
import { LXRLocomotionController } from "./LXRLocomotionController";
import { LXRInputManager } from "./input/LXRInputManager";
import { LXRActionMap } from "./input/LXRActionMap";
import { LXR_DEFAULT_PROFILES_PATH } from "./input/LXRInputProfiles";
import { LXRPlacement } from "./anchor/LXRPlacement";
import { LXROverlay } from "./overlay/LXROverlay";
import {
    LXRFrameCallbacks,
    LXRFrameErrorLog,
    LXR_FRAME_PHASES,
    type LXRFrameCallback,
    type LXRFrameCallbackArgs,
    type LXRFramePhase,
} from "./LXRFrameLoop";
import { Quaternion, Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
/**
 * Seconds the comfort vignette takes to close once locomotion starts. Short: the vection it is
 * there to suppress starts with the movement, so a vignette that arrives late has already missed
 * the moment it exists for.
 */
const VIGNETTE_FADE_IN_SECONDS = 0.12;

/**
 * Seconds the comfort vignette takes to open again once locomotion stops. Longer than the fade in,
 * so that tapping a stick repeatedly does not strobe the periphery.
 */
const VIGNETTE_FADE_OUT_SECONDS = 0.35;

/**
 * Longest frame delta the vignette fade will honour, in seconds, so a stalled frame does not turn
 * the fade into a cut.
 */
const MAX_VIGNETTE_FADE_DELTA_SECONDS = 0.1;

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
     * The session's input sources, built by {@link initialize} and released with the session.
     */
    #input?: LXRInputManager;

    /**
     * Base URL the controller profile descriptions are fetched from. See {@link input_profiles_path}.
     */
    #input_profiles_path: string = LXR_DEFAULT_PROFILES_PATH;

    /**
     * The bindings turning the input sources into actions, and the actions themselves. Built once
     * and kept across sessions — see {@link actions}.
     */
    readonly #actions: LXRActionMap = new LXRActionMap();

    /**
     * Everything between an action and the rig moving. Built with the rig in the constructor and
     * kept across sessions — see {@link locomotion}.
     */
    readonly #locomotion: LXRLocomotionController;

    /**
     * Everything between a real surface and the scene standing on it. Built with the rig in the
     * constructor and kept across sessions — see {@link placement}.
     */
    readonly #placement: LXRPlacement;

    /**
     * Everything the session draws that is not the streamed image. Built with the rendering surface
     * in the constructor — see {@link overlay}.
     */
    readonly #overlay: LXROverlay;

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
     * Deduplicating log for everything {@link #onXRFrame} catches outside a consumer callback. A
     * failing frame usually fails again on the next one, so only transitions are logged rather than
     * every frame of a 72–90 Hz loop.
     */
    readonly #frame_error_log = new LXRFrameErrorLog();

    /**
     * Consumer callbacks, one list per {@link LXRFramePhase}, run in phase order by
     * {@link #onXRFrame} before the rig update and the draw.
     */
    readonly #frame_callbacks: Record<LXRFramePhase, LXRFrameCallbacks> = {
        input: new LXRFrameCallbacks("input"),
        anchor: new LXRFrameCallbacks("anchor"),
    };

    /**
     * The argument object handed to every frame callback, refilled rather than rebuilt each frame.
     * Its contents are only valid during the call — see {@link LXRFrameCallbackArgs}.
     */
    readonly #frame_callback_args: LXRFrameCallbackArgs = {
        frame: undefined as unknown as XRFrame,
        time: 0,
        dt: 0,
        viewer_pose: null,
    };

    /**
     * Scratch arrays refilled by {@link #renderXRFrame} every frame. Their contents never outlive
     * the frame that fills them — {@link LXRCameraRig.update} mutates the transforms in place and
     * {@link LXRContext.drawXRFrame} consumes everything synchronously — so rebuilding four arrays
     * per frame was pure garbage at display rate.
     */
    readonly #frame_scratch: {
        xr_views: XRView[];
        lxr_viewports: LXRViewport[];
        remote_camera_transforms: ReturnType<LXRViewport["getCameraRemoteTransform"]>[];
        xr_viewports: XRViewport[];
    } = {
        xr_views: [],
        lxr_viewports: [],
        remote_camera_transforms: [],
        xr_viewports: [],
    };

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
     * Scene-space depth the latency-compensation billboard stands in for, in scene units. See
     * {@link billboard_reference_depth}.
     */
    #billboard_reference_depth: number = 25;

    /**
     * How far the comfort vignette closes at full locomotion. See {@link comfort_vignette_strength}.
     */
    #comfort_vignette_strength: number = LXR_DEFAULT_COMFORT_VIGNETTE_STRENGTH;

    /**
     * Current position of the comfort vignette fade, in `[0, 1]`, eased towards the locomotion
     * intensity every frame.
     */
    #vignette_intensity: number = 0;

    /**
     * Timestamp of the previous XR frame, used to derive the frame delta the vignette fade needs.
     * 0 means there has not been one yet.
     */
    #last_frame_timestamp: DOMHighResTimeStamp = 0;

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
        this.#locomotion = new LXRLocomotionController({ camera_rig: this.#camera_rig });
        this.#placement = new LXRPlacement({ camera_rig: this.#camera_rig });
        this.#overlay = new LXROverlay({ context: this.#surface.context });
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
     * Scene-space depth the latency-compensation billboard stands in for, in scene units.
     *
     * The billboard is drawn in XR space, where the same scene depth lands `camera_rig.scale`
     * metres away, so the metric distance handed to the context is this value scaled by the rig —
     * see {@link #updateBillboardDistance}. Raise it for a scene whose interesting content sits
     * further out than the default, lower it for one the user is right up against.
     */
    get billboard_reference_depth(): number {
        return this.#billboard_reference_depth;
    }

    /**
     * Set the scene-space depth the latency-compensation billboard stands in for, in scene units.
     */
    set billboard_reference_depth(value: number) {
        if (!(value > 0)) {
            throw new Error("Billboard reference depth must be strictly positive");
        }

        this.#billboard_reference_depth = value;
    }

    /**
     * How far the comfort vignette closes when the user is at full virtual locomotion speed, from 0
     * (never) to 1 (down to a narrow tunnel).
     *
     * Restricting the periphery during virtual locomotion is the standard countermeasure to
     * simulator sickness: the optical flow claiming the user is moving is strongest at the edge of
     * the field of view, and that is exactly where the inner ear has nothing to corroborate it
     * with. The vignette fades in and out with the motion rather than following it instantly.
     *
     * Defaulted per session mode by {@link initialize} — on by default in a headset, off in
     * handheld AR, where the room around the screen is already a fixed reference and darkening the
     * edges of a phone just reads as a rendering fault.
     */
    get comfort_vignette_strength(): number {
        return this.#comfort_vignette_strength;
    }

    /**
     * Set how far the comfort vignette closes at full virtual locomotion speed. 0 disables it.
     */
    set comfort_vignette_strength(value: number) {
        if (value < 0 || value > 1) {
            throw new Error("Comfort vignette strength must be between 0 and 1");
        }

        this.#comfort_vignette_strength = value;
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
     * The session's input sources — controllers, hands, gaze and screen taps — refreshed once per
     * frame, before the `input` phase. Undefined until {@link initialize} has run and again after
     * {@link release}.
     */
    get input(): LXRInputManager | undefined {
        return this.#input;
    }

    /**
     * What the user is asking for this frame — move, turn, place, select — resolved from every
     * input source before the `input` phase runs.
     *
     * Always present, unlike {@link input}: its bindings are consumer configuration rather than
     * session state, so they can be set before a session exists and survive one ending. Outside a
     * session every action simply reads as at rest.
     */
    get actions(): LXRActionMap {
        return this.#actions;
    }

    /**
     * How those actions move the user — speeds, comfort conditioning, snap turn — and the channel a
     * virtual joystick or any other non-XR input writes through.
     *
     * Always present, like {@link actions}, and enabled by default: with the default bindings a
     * consumer gets thumbstick locomotion in a headset without writing any of it. Set
     * {@link LXRLocomotionController.enabled} to false for an application that drives the rig
     * itself.
     */
    get locomotion(): LXRLocomotionController {
        return this.#locomotion;
    }

    /**
     * AR placement: the hit test finding the surface the user is aiming at, the anchor keeping the
     * scene nailed to it, and the rig anchor both are written to.
     *
     * Always present, like {@link actions} and {@link locomotion} — its parameters are consumer
     * configuration rather than session state. {@link LXRPlacement.is_available} is what says
     * whether this session can place anything at all, and it is settled by the time
     * {@link initialize} resolves.
     */
    get placement(): LXRPlacement {
        return this.#placement;
    }

    /**
     * The quads drawn into the XR framebuffer alongside the streamed image — a placement reticle, a
     * panel, a pointer.
     *
     * The only way to show a user anything in a headset: see {@link has_dom_overlay}. Always
     * present, like {@link placement}, though its GPU resources only exist while there is something
     * to draw.
     */
    get overlay(): LXROverlay {
        return this.#overlay;
    }

    /**
     * Whether the DOM is composited into this session, i.e. whether `dom-overlay` was requested and
     * granted.
     *
     * False in every headset session, AR passthrough included — no headset browser grants the
     * feature — and true in a handheld AR session on Android. When it is false, nothing in the DOM
     * is visible to the user, however carefully it is positioned: what has to be seen goes through
     * {@link overlay} instead.
     */
    get has_dom_overlay(): boolean {
        return !!this.#session.native?.domOverlayState;
    }

    /**
     * Base URL the `@webxr-input-profiles/assets` descriptions are fetched from.
     *
     * Point it at a self-hosted copy to keep named components — `a-button`, `thumbrest`, a touchpad
     * next to a stick — working on a network that cannot reach the default CDN. Bindings written
     * against the `xr-standard` components keep working either way; see {@link LXRInputProfiles}.
     *
     * Read by {@link initialize}, so it has to be set before the session comes up.
     */
    get input_profiles_path(): string {
        return this.#input_profiles_path;
    }

    /**
     * Set the base URL the controller profile descriptions are fetched from. See
     * {@link input_profiles_path}.
     */
    set input_profiles_path(value: string) {
        this.#input_profiles_path = value;
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

        this.#reportDomOverlayState({ session, xr_session_init });

        // Adopted here rather than by whoever consumes the input, and as early as the session
        // exists: controllers that were already awake fired their `inputsourceschange` before this
        // method was even called, so anything built later would be waiting for an event that has
        // already happened. Not awaited either — registration is synchronous, and the profile
        // descriptions behind it are a CDN round trip that has no business holding up the session
        // coming up.
        this.#input?.release();
        this.#input = new LXRInputManager({ session, profiles_path: this.#input_profiles_path });
        void this.#input.init();

        // Bindings are kept, per-source state is not: the sources of the previous session are gone,
        // and an action left engaged by one would still read as held on the first frame of this one.
        // Same for locomotion, whose ramps must not resume mid-throw in a session that has only just
        // started.
        this.#actions._reset();
        this.#locomotion._reset();
        this.#placement._reset();

        // Comfort defaults follow the device class, like the vignette below: snap turning in a
        // headset, where continuous yaw is the most reliable way to make someone sick, and smooth
        // on a handheld screen, where a window that snaps in 45° steps reads as a fault.
        this.#locomotion.turn_mode = defaultTurnModeForSessionMode(mode);

        this.#throwIfAborted(signal);

        // Configure XRWebGLLayer and display parameters
        const xr_views = await this.#surface.initialize({ session, is_ar });
        this.#throwIfAborted(signal);

        // Comfort defaults follow the device class, like fake alpha above — see
        // `comfort_vignette_strength`. A consumer that wants something else sets it after this
        // resolves, which is the same contract `enable_fake_alpha` already has.
        this.#comfort_vignette_strength = is_ar ? 0 : LXR_DEFAULT_COMFORT_VIGNETTE_STRENGTH;

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

        // Awaited, unlike the input profile fetch above: `requestHitTestSource` is a local round
        // trip rather than a CDN one, and awaiting it is what makes `placement.is_available`
        // meaningful the moment this method resolves — a consumer deciding whether to show a place
        // control has no event to wait for otherwise. It never throws; a session with no `hit-test`
        // feature, or a user agent without it, simply leaves placement unavailable.
        await this.#placement._init({ session });
        this.#throwIfAborted(signal, "placement configuration");

        // Add viewports to livelink after they have been configured
        this.#livelink.addViewports({ viewports: this.viewports });

        console.debug("XRLivelink configured successfully");
        return session;
    }

    /**
     * Say out loud whether the DOM is composited into this session, when the consumer asked for it.
     *
     * `dom-overlay` is an optional feature, and a user agent that does not grant one reports
     * nothing at all — which is why a DOM reticle being invisible on a headset read as a mystery
     * for as long as it did, rather than as the one line it is. Everything in the DOM is silently
     * absent from every headset session; see {@link overlay} for what to do instead.
     *
     * @param session The session that has just come up.
     * @param xr_session_init What was asked for when requesting it.
     */
    #reportDomOverlayState({
        session,
        xr_session_init,
    }: {
        session: XRSession;
        xr_session_init: XRSessionInit;
    }): void {
        const was_requested =
            !!xr_session_init.domOverlay || !!xr_session_init.optionalFeatures?.includes("dom-overlay");
        if (!was_requested || session.domOverlayState) {
            return;
        }

        console.warn(
            "WebXR: `dom-overlay` was requested and not granted — nothing in the DOM is composited " +
                "into this session. Draw through `XRLivelink.overlay` instead.",
        );
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
        this.#last_frame_timestamp = 0;
        this.#vignette_intensity = 0;
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
     * Register a callback to run once per XR frame, in the given phase.
     *
     * This is the only frame loop of the session. A consumer arming its own
     * `XRSession.requestAnimationFrame` gets no ordering guarantee against this one, which matters
     * as soon as it writes something the rig or the draw then reads: an anchor transform updated
     * after the frame that consumed it is a frame of lag, seen as anchored content jittering
     * against the real world. Registering here instead puts the work in a defined place — `input`,
     * then `anchor`, then the rig update, then the draw.
     *
     * The loop keeps running through a callback that throws, and stops calling every callback once
     * the session ends, so a consumer cannot strand a loop it did not start.
     *
     * @param phase When in the frame to run. Defaults to `input`.
     * @param callback The callback to run. Registering the same function twice has no effect.
     * @returns A function unregistering the callback.
     */
    public addFrameCallback({
        phase = "input",
        callback,
    }: {
        phase?: LXRFramePhase;
        callback: LXRFrameCallback;
    }): () => void {
        return this.#frame_callbacks[phase].add(callback);
    }

    /**
     * Unregister a callback previously passed to {@link addFrameCallback}. Calling the function
     * that method returned does the same thing.
     *
     * @param phase The phase it was registered in. Defaults to `input`.
     * @param callback The callback to remove.
     */
    public removeFrameCallback({
        phase = "input",
        callback,
    }: {
        phase?: LXRFramePhase;
        callback: LXRFrameCallback;
    }): void {
        this.#frame_callbacks[phase].remove(callback);
    }

    /**
     * XR frame callback, and the session's only one. Runs the frame phases in order — `input`,
     * `anchor`, then the rig update and the draw of {@link #renderXRFrame} — and re-arms the loop,
     * whatever any of them did.
     *
     * A frame is allowed to fail. The session is still alive when it does, so a loop that stopped
     * re-arming would leave the user staring at the last frame ever drawn, rigidly following their
     * head with no way out but a page reload. Skipping a frame is recoverable; dying is not.
     *
     * @param time The high resolution timestamp for the current frame, used to derive the frame delta time-based effects need.
     * @param frame The XRFrame containing the latest pose and view data from the XR session, which is used to update the viewports and render the frame.
     */
    #onXRFrame = (time: DOMHighResTimeStamp, frame: XRFrame): void => {
        const dt = this.#last_frame_timestamp ? (time - this.#last_frame_timestamp) / 1000 : 0;
        this.#last_frame_timestamp = time;

        // One viewer pose for the whole frame. Every phase wants it — the anchor phase to project
        // onto the screen, the draw to place the cameras — and it cannot change within a frame.
        const viewer_pose = this.#getViewerPose(frame);

        // Ahead of every phase: a consumer callback in the `input` phase reads controller state,
        // and it has to be this frame's, not the one before it. The actions are resolved straight
        // after the sources they are read from, and before anything can consume one.
        this.#input?.update({ frame, reference_space: this.#session.reference_space ?? null });
        this.#actions._update({ sources: this.#input?.sources ?? [] });

        const args = this.#frame_callback_args;
        args.frame = frame;
        args.time = time;
        args.dt = dt;
        args.viewer_pose = viewer_pose;

        this.#frame_callbacks.input.run(args);

        // Between the two phases rather than inside either: a consumer raises `place` from the
        // `input` phase and the same frame's live hit test result honours it — an `XRHitTestResult`
        // being valid only during its own frame — while an `anchor` phase callback drawing a
        // reticle reads this frame's hit pose rather than the previous one's.
        this.#placement._update({
            frame,
            time,
            reference_space: this.#session.reference_space ?? null,
            input: this.#input,
        });

        this.#frame_callbacks.anchor.run(args);

        // After the phases and before the rig composes: a consumer callback — and, in a headset, a
        // pointer aimed at a panel — gets to claim an action before locomotion reads it, and the
        // movement still lands on the frame that draws it rather than the one after.
        this.#locomotion._update({ dt, actions: this.#actions });

        try {
            this.#renderXRFrame({ dt, viewer_pose });
            this.#frame_error_log.reportSuccess();
        } catch (error) {
            this.#frame_error_log.report("Skipped an XR frame", error);
        }

        // Nothing may hold on to a pose the user agent is about to invalidate.
        args.frame = undefined as unknown as XRFrame;
        args.viewer_pose = null;
        this.#input?.endFrame();

        this.#requestNextXRFrame();
    };

    /**
     * Read the viewer pose for the current frame, once, for every phase to share.
     *
     * Never throws: a missing reference space or a user agent refusing the pose is a frame with
     * nothing truthful to draw, which every consumer of the pose already handles, and not a reason
     * to skip the phases that do not need it.
     *
     * @param frame The XRFrame to read the pose from.
     * @returns The viewer pose, or null if there is none for this frame.
     */
    #getViewerPose(frame: XRFrame): XRViewerPose | null {
        const { reference_space } = this.#session;
        if (!reference_space) {
            return null;
        }

        try {
            return frame.getViewerPose(reference_space) ?? null;
        } catch (error) {
            this.#frame_error_log.report("Could not read the XR viewer pose", error);
            return null;
        }
    }

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
     * @param dt Seconds since the previous XR frame, 0 on the first one.
     * @param viewer_pose The viewer pose for this frame, resolved once by {@link #onXRFrame}, or null when there is none.
     */
    #renderXRFrame({ dt, viewer_pose }: { dt: number; viewer_pose: XRViewerPose | null }): void {
        if (!viewer_pose) {
            return;
        }

        const gl_layer = this.#base_gl_layer;
        const { xr_views, lxr_viewports, remote_camera_transforms, xr_viewports } = this.#frame_scratch;
        xr_views.length = 0;
        lxr_viewports.length = 0;
        remote_camera_transforms.length = 0;
        xr_viewports.length = 0;

        // Keep only the XR views that have corresponding viewports (e.g. in case of more than 2 views,
        // or views for which we failed to initialize a viewport, or force_single_view mode which only initializes a
        // viewport for the first view)
        for (const xr_view of viewer_pose.views) {
            if (this.#lxr_viewports.has(xr_view.eye)) {
                xr_views.push(xr_view);
            }
        }

        // Compute center eye position for camera IPD offset calculations
        this.#camera_rig.updateXrSpaceCenterEye(xr_views);

        // Update each viewport with latest XR view data
        for (const xr_view of xr_views) {
            const lxr_viewport = this.#getLXRViewportByEye(xr_view.eye);
            this.#updateViewport({ xr_view, lxr_viewport, gl_layer, center_eye: this.#camera_rig.xr_space_center_eye });
            lxr_viewports.push(lxr_viewport);
            xr_viewports.push(lxr_viewport.xr_viewport);
            remote_camera_transforms.push(lxr_viewport.getCameraRemoteTransform());
        }

        // Update camera rig with latest center eye position and remote camera transforms for this frame.
        // The rig uses this data to compute the final camera transforms for the viewports, which may include virtual
        // movement offsets and/or latency compensation adjustments.
        this.#camera_rig.update({ remote_camera_transforms });

        // Keep the billboard at the apparent depth of the scene, which the rig scale moves.
        this.#updateBillboardDistance(xr_views);

        // Close the comfort vignette by as much as the user is moving under virtual locomotion.
        this.#updateComfortVignette(dt);

        // Draw the frame for each viewport with the latest XR view and remote camera transform data
        this.#surface.context.drawXRFrame({
            xr_views,
            xr_viewports,
            frame_camera_transforms: remote_camera_transforms,
        });

        // On top of the streamed image, in the same framebuffer: in a headset that is the only
        // place a user can be shown anything at all.
        this.#overlay._draw({ xr_views, xr_viewports, frame_buffer: gl_layer.framebuffer });
    }

    /**
     * Place the latency-compensation billboard at the apparent depth of the scene for this frame.
     *
     * The rig divides camera positions by its scale, so a point `d` scene units from the camera is
     * `d * scale` metres away in XR space — a fixed 25 m plane is only right at scale 1, and lands
     * a kilometre inside the content at 1000:1 or well behind the user's hands at "Fit 1m³". The
     * reprojection is exact only on the plane itself, and everywhere else the error grows with the
     * distance to it, so the plane follows the scale.
     *
     * The result is clamped to the frustum the projection matrix actually describes: a billboard
     * past the far plane is clipped away entirely and one inside the near plane just as much, and
     * the extreme scale steps reach both ends.
     *
     * @param xr_views The XR views for this frame, whose projection matrix gives the frustum bounds.
     */
    #updateBillboardDistance(xr_views: readonly XRView[]): void {
        if (xr_views.length === 0) {
            return;
        }

        const projection_matrix = xr_views[0].projectionMatrix;
        const near_plane = projection_matrix[14] / (projection_matrix[10] - 1);
        const far_plane = projection_matrix[14] / (projection_matrix[10] + 1);

        const min_distance = near_plane * 2;
        // An infinite far plane — projection_matrix[10] === -1 — yields a non-finite far_plane here.
        const max_distance = Number.isFinite(far_plane) ? Math.max(far_plane * 0.5, min_distance) : Infinity;

        const distance = this.#billboard_reference_depth * this.#camera_rig.scale;
        this.#surface.context.screen_distance = Math.min(Math.max(distance, min_distance), max_distance);
    }

    /**
     * Ease the comfort vignette towards the locomotion the camera rig reports for this frame, and
     * hand the result to the context that draws it.
     *
     * Eased rather than applied directly because the intensity itself is a stick position: it
     * arrives as a step the moment the user pushes, and a periphery that snaps dark is its own
     * discomfort. The rig accumulator is drained on every frame, including the ones where the
     * vignette is disabled, so that turning it back on mid-session does not inherit a stale value.
     *
     * @param dt Seconds since the previous XR frame.
     */
    #updateComfortVignette(dt: number): void {
        const target = this.#camera_rig._consumeLocomotionIntensity();
        const { context } = this.#surface;

        if (this.#comfort_vignette_strength === 0) {
            this.#vignette_intensity = 0;
            context.vignette_strength = 0;
            return;
        }

        if (dt > 0) {
            const fade_time = target > this.#vignette_intensity ? VIGNETTE_FADE_IN_SECONDS : VIGNETTE_FADE_OUT_SECONDS;
            const max_delta = Math.min(dt, MAX_VIGNETTE_FADE_DELTA_SECONDS) / fade_time;
            const delta = target - this.#vignette_intensity;
            this.#vignette_intensity += Math.abs(delta) <= max_delta ? delta : Math.sign(delta) * max_delta;
        }

        context.vignette_strength = this.#vignette_intensity * this.#comfort_vignette_strength;
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

        // Consumers unregister themselves as they tear down, but nothing orders their teardown
        // against this one, and a released session must not keep any of them alive.
        for (const phase of LXR_FRAME_PHASES) {
            this.#frame_callbacks[phase].clear();
        }

        this.#input?.release();
        this.#input = undefined;
        this.#actions._reset();
        this.#locomotion._reset();
        this.#placement._reset();
        this.#overlay._release();

        this.#lxr_viewports.forEach(lxr_viewport => lxr_viewport.release());
        this.#lxr_viewports.clear();
        this.#surface.release();

        await Promise.all([this.#camera_rig.release(), this.#session.release()]);
    }
}

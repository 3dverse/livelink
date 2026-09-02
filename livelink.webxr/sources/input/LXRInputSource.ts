//------------------------------------------------------------------------------
import type { MotionController } from "@webxr-input-profiles/motion-controllers";

//------------------------------------------------------------------------------
import { LXRFrameErrorLog } from "../LXRFrameLoop";
import type { LXRResolvedProfile } from "./LXRInputProfiles";

//------------------------------------------------------------------------------
/**
 * How far a component is engaged, as the profile registry defines it.
 *
 * - `default` — untouched.
 * - `touched` — a finger is resting on it, or an axis has left its centre.
 * - `pressed` — fully actuated.
 *
 * The three are exclusive: a pressed button reports `pressed`, not `touched`. Use
 * {@link LXRComponentState.touched} for "a finger is on it, pressed or not".
 */
export type LXRComponentPhase = "default" | "touched" | "pressed";

//------------------------------------------------------------------------------
/**
 * A change in a button's pressed state on this frame, or `""` on the frames — the vast majority —
 * where nothing changed.
 */
export type LXRButtonEdge = "" | "down" | "up";

//------------------------------------------------------------------------------
/**
 * The state of one profile component for the current frame.
 *
 * Refilled in place every frame rather than rebuilt, since this runs at display rate: read what is
 * needed out of it, do not retain it.
 */
export type LXRComponentState = {
    /**
     * The profile component id, e.g. `xr-standard-thumbstick` or `a-button`.
     */
    id: string;

    /**
     * The component type the profile declares, e.g. `trigger`, `thumbstick`, `button`.
     */
    type: string;

    /**
     * How far the component is engaged. See {@link LXRComponentPhase}.
     */
    state: LXRComponentPhase;

    /**
     * Whether the component is fully actuated.
     */
    pressed: boolean;

    /**
     * Whether a finger is on the component, which a pressed component also reports.
     */
    touched: boolean;

    /**
     * Analog button value in `[0, 1]`, 0 for a component with no button.
     */
    value: number;

    /**
     * Whether {@link pressed} changed on this frame, and in which direction.
     */
    event: LXRButtonEdge;

    /**
     * Horizontal axis in `[-1, 1]`, 0 for a component with no axes.
     */
    x_axis: number;

    /**
     * Vertical axis in `[-1, 1]`, 0 for a component with no axes. Positive is *down* on every
     * conformant device, which is the opposite of what "forward" means to a locomotion binding.
     */
    y_axis: number;

    /**
     * Whether the profile gives this component a gamepad button index.
     */
    has_button: boolean;

    /**
     * Whether the profile gives this component gamepad axis indices.
     */
    has_axes: boolean;
};

//------------------------------------------------------------------------------
/**
 * The state reported for a component the source's profile does not describe.
 *
 * Returned by {@link LXRInputSource.getComponent} so that a binding naming a component the device
 * happens not to have reads as "at rest" rather than throwing. `has_button` and `has_axes` are both
 * false, which is how a caller tells absent from idle.
 */
export const LXR_ABSENT_COMPONENT: Readonly<LXRComponentState> = Object.freeze({
    id: "",
    type: "",
    state: "default",
    pressed: false,
    touched: false,
    value: 0,
    event: "",
    x_axis: 0,
    y_axis: 0,
    has_button: false,
    has_axes: false,
} satisfies LXRComponentState);

//------------------------------------------------------------------------------
/**
 * The state of one raw gamepad button for the current frame, addressed by index.
 *
 * Refilled in place every frame, like {@link LXRComponentState}.
 */
export type LXRButtonState = {
    /**
     * Index of the button in the gamepad's own array.
     */
    index: number;

    /**
     * Whether the button is pressed.
     */
    pressed: boolean;

    /**
     * Whether a finger is on the button, reported independently of {@link pressed} — unlike the
     * profile component state, which is exclusive.
     */
    touched: boolean;

    /**
     * Analog value in `[0, 1]`.
     */
    value: number;

    /**
     * Whether {@link pressed} changed on this frame, and in which direction.
     */
    event: LXRButtonEdge;
};

//------------------------------------------------------------------------------
/**
 * The state reported for a gamepad button index the source does not have.
 */
export const LXR_ABSENT_BUTTON: Readonly<LXRButtonState> = Object.freeze({
    index: -1,
    pressed: false,
    touched: false,
    value: 0,
    event: "",
} satisfies LXRButtonState);

//------------------------------------------------------------------------------
/**
 * Longest run of unread select or squeeze edges kept. Two edges per frame is already a click faster
 * than a human, and anything beyond that is a consumer that stopped reading.
 */
const MAX_PENDING_EDGES = 8;

//------------------------------------------------------------------------------
/**
 * One live {@link XRInputSource}: its components for the current frame, the edges of its primary
 * and squeeze actions, and its poses.
 *
 * Owned by {@link LXRInputManager}, which creates one per input source the session reports and
 * refreshes it once per frame. It is keyed by the `XRInputSource` object itself rather than by
 * handedness, because the spec allows several sources to report `none` at once — a single-controller
 * headset and a screen tap both do — and a map keyed by hand silently collapses them.
 *
 * @experimental
 */
export class LXRInputSource {
    /**
     * The input source this wraps, valid for as long as the session reports it.
     */
    readonly xr_input_source: XRInputSource;

    /**
     * The state of every component the profile describes, keyed by profile component id. Empty
     * until the profile resolves, and for a source with no gamepad.
     */
    readonly components: Record<string, LXRComponentState> = {};

    /**
     * The raw gamepad buttons, by index. Grown to match the gamepad on the first frame it is read.
     */
    readonly #buttons: LXRButtonState[] = [];

    /**
     * The component reader built from the resolved profile, or null while it is still resolving and
     * for a source with nothing to poll.
     */
    #motion_controller: MotionController | null = null;

    /**
     * Id of the resolved profile, undefined until it resolves.
     */
    #profile_id?: string;

    /**
     * Progressively more generic profiles the device declares itself compatible with.
     */
    #fallback_profile_ids: readonly string[] = [];

    /**
     * URL of the profile's controller model, when it has one.
     */
    #asset_path?: string;

    /**
     * Whether the profile came from the built-in `xr-standard` description rather than the registry.
     */
    #is_built_in_profile: boolean = false;

    /**
     * Whether profile resolution has finished, whatever it produced. A source with no gamepad
     * resolves to nothing and is still resolved — this is what tells "still fetching" apart from
     * "has no components", which otherwise look identical.
     */
    #is_profile_resolved: boolean = false;

    /**
     * The frame the current state was read from, null outside a frame.
     */
    #frame: XRFrame | null = null;

    /**
     * The reference space poses are resolved in, null outside a frame.
     */
    #reference_space: XRReferenceSpace | null = null;

    /**
     * Cached target ray pose for the current frame, and whether it has been asked for yet.
     */
    #target_ray_pose: XRPose | null = null;
    #is_target_ray_pose_resolved: boolean = false;

    /**
     * Cached grip pose for the current frame, and whether it has been asked for yet.
     */
    #grip_pose: XRPose | null = null;
    #is_grip_pose_resolved: boolean = false;

    /**
     * Whether the primary action is currently held, and the edge to report for this frame.
     */
    #select_active: boolean = false;
    #select_event: LXRButtonEdge = "";

    /**
     * Whether the squeeze action is currently held, and the edge to report for this frame.
     */
    #squeeze_active: boolean = false;
    #squeeze_event: LXRButtonEdge = "";

    /**
     * Edges that arrived since the last frame, oldest first, one released per frame.
     *
     * A queue rather than a flag because the session events do not wait for frames: a quick tap
     * puts both a `down` and an `up` in the same gap, and collapsing them into "unchanged" loses
     * the click entirely.
     */
    readonly #select_edges: LXRButtonEdge[] = [];
    readonly #squeeze_edges: LXRButtonEdge[] = [];

    /**
     * Deduplicating log for pose reads, which fail the same way on every frame when they fail.
     */
    readonly #pose_error_log = new LXRFrameErrorLog();

    /**
     * @param xr_input_source The input source to wrap.
     */
    constructor({ xr_input_source }: { xr_input_source: XRInputSource }) {
        this.xr_input_source = xr_input_source;
    }

    /**
     * Which hand holds this source, or `none`. Several sources may report `none` at once.
     */
    get handedness(): XRHandedness {
        return this.xr_input_source.handedness;
    }

    /**
     * How this source is aimed, which is what decides the interaction model:
     * `tracked-pointer` gets a laser and a cursor, `gaze` a cursor alone, `screen` and
     * `transient-pointer` neither, since the DOM is already handling the touch.
     */
    get target_ray_mode(): XRTargetRayMode {
        return this.xr_input_source.targetRayMode;
    }

    /**
     * Whether this source is a tracked hand rather than a held device.
     */
    get is_hand(): boolean {
        return this.xr_input_source.hand !== undefined && this.xr_input_source.hand !== null;
    }

    /**
     * Whether this source has a gamepad, and therefore components to poll.
     */
    get has_gamepad(): boolean {
        return this.xr_input_source.gamepad !== undefined && this.xr_input_source.gamepad !== null;
    }

    /**
     * The profile ids the device declares, most specific first, straight from the session.
     */
    get profiles(): readonly string[] {
        return this.xr_input_source.profiles;
    }

    /**
     * Id of the resolved profile, undefined until it resolves and for a source with no gamepad.
     */
    get profile_id(): string | undefined {
        return this.#profile_id;
    }

    /**
     * Progressively more generic profiles the resolved one declares itself compatible with.
     */
    get fallback_profile_ids(): readonly string[] {
        return this.#fallback_profile_ids;
    }

    /**
     * URL of the resolved profile's controller model, when it has one.
     */
    get asset_path(): string | undefined {
        return this.#asset_path;
    }

    /**
     * Whether the resolved profile is the built-in `xr-standard` description, in which case only
     * the guaranteed components exist. See {@link LXRInputProfiles}.
     */
    get is_built_in_profile(): boolean {
        return this.#is_built_in_profile;
    }

    /**
     * Whether profile resolution has finished. See {@link #is_profile_resolved}.
     */
    get is_profile_resolved(): boolean {
        return this.#is_profile_resolved;
    }

    /**
     * The component reader behind {@link components}, for a consumer driving a controller model
     * from its visual responses. Null until the profile resolves.
     */
    get motion_controller(): MotionController | null {
        return this.#motion_controller;
    }

    /**
     * Whether the primary action is currently held.
     *
     * This is the session's own `select`, which every input source has however it is driven — a
     * controller trigger, a pinch, a gaze dwell, a screen tap. A binding consumes this or the
     * trigger component, never both: on a controller they are the same physical press reported
     * twice.
     */
    get select_active(): boolean {
        return this.#select_active;
    }

    /**
     * Whether the primary action changed on this frame, and in which direction.
     */
    get select_event(): LXRButtonEdge {
        return this.#select_event;
    }

    /**
     * Whether the squeeze action is currently held.
     */
    get squeeze_active(): boolean {
        return this.#squeeze_active;
    }

    /**
     * Whether the squeeze action changed on this frame, and in which direction.
     */
    get squeeze_event(): LXRButtonEdge {
        return this.#squeeze_event;
    }

    /**
     * Where this source is aiming, in the session reference space, or null when tracking is lost or
     * there is no frame.
     *
     * Resolved on first read and cached for the rest of the frame: `getPose` is a user agent call
     * at display rate, and it cannot change within a frame. The pose is invalidated when the frame
     * ends, so it must not be retained.
     */
    get target_ray_pose(): XRPose | null {
        if (!this.#is_target_ray_pose_resolved) {
            this.#is_target_ray_pose_resolved = true;
            this.#target_ray_pose = this.#getPose(this.xr_input_source.targetRaySpace);
        }
        return this.#target_ray_pose;
    }

    /**
     * Where this source is held, in the session reference space, or null when it has no grip space
     * — a gaze or screen source has none — when tracking is lost, or when there is no frame.
     *
     * Cached for the frame, like {@link target_ray_pose}.
     */
    get grip_pose(): XRPose | null {
        if (!this.#is_grip_pose_resolved) {
            this.#is_grip_pose_resolved = true;
            const { gripSpace } = this.xr_input_source;
            this.#grip_pose = gripSpace ? this.#getPose(gripSpace) : null;
        }
        return this.#grip_pose;
    }

    /**
     * Whether the resolved profile describes the given component.
     *
     * @param id The profile component id.
     */
    hasComponent(id: string): boolean {
        return id in this.components;
    }

    /**
     * The state of one component for the current frame.
     *
     * @param id The profile component id, e.g. `xr-standard-thumbstick`.
     * @returns Its state, or {@link LXR_ABSENT_COMPONENT} when the profile does not describe it.
     */
    getComponent(id: string): Readonly<LXRComponentState> {
        return this.components[id] ?? LXR_ABSENT_COMPONENT;
    }

    /**
     * The raw gamepad buttons of this source, by index. Empty for a source with no gamepad.
     */
    get buttons(): readonly Readonly<LXRButtonState>[] {
        return this.#buttons;
    }

    /**
     * The state of one raw gamepad button, for a button the profile does not describe.
     *
     * This is an escape hatch and reads like one. The `xr-standard` mapping fixes indices 0–3 —
     * trigger, squeeze, touchpad, thumbstick — and defines nothing above them, so whether index 5
     * is a face button, a bumper or absent is a fact about one device and one firmware. A binding
     * that names a profile component through {@link getComponent} works on every device the
     * registry covers; one written here works on the device it was tested against.
     *
     * The reason it exists at all: some devices expose buttons their registry profile does not
     * describe, and the alternative to an explicit index is a silently dead binding.
     *
     * @param index Index of the button in the gamepad's own array.
     * @returns Its state, or {@link LXR_ABSENT_BUTTON} when the source has no such button.
     */
    getButton(index: number): Readonly<LXRButtonState> {
        return this.#buttons[index] ?? LXR_ABSENT_BUTTON;
    }

    /**
     * @internal
     *
     * Attach the resolved profile, building the component state this source reports from now on.
     *
     * @param resolved The resolved profile, or null when the source has nothing to poll.
     */
    _setProfile(resolved: LXRResolvedProfile | null): void {
        this.#is_profile_resolved = true;

        if (!resolved) {
            return;
        }

        const { profile_id, fallback_profile_ids, asset_path, motion_controller, is_built_in } = resolved;
        this.#profile_id = profile_id;
        this.#fallback_profile_ids = fallback_profile_ids;
        this.#asset_path = asset_path;
        this.#motion_controller = motion_controller;
        this.#is_built_in_profile = is_built_in;

        for (const [id, component] of Object.entries(motion_controller.components)) {
            const { button, xAxis, yAxis } = component.gamepadIndices;
            this.components[id] = {
                id,
                type: component.type,
                state: "default",
                pressed: false,
                touched: false,
                value: 0,
                event: "",
                x_axis: 0,
                y_axis: 0,
                has_button: button !== undefined,
                has_axes: xAxis !== undefined && yAxis !== undefined,
            };
        }

        console.debug(
            `Resolved the ${this.handedness} XR input source as "${profile_id}"`,
            is_built_in ? "(built-in xr-standard description)" : `(fallbacks: ${fallback_profile_ids.join(", ")})`,
            Object.keys(this.components),
        );
    }

    /**
     * @internal
     *
     * Record a change of the primary action, straight from the session event.
     *
     * @param edge The direction of the change.
     */
    _pushSelectEdge(edge: LXRButtonEdge): void {
        this.#pushEdge(this.#select_edges, edge);
    }

    /**
     * @internal
     *
     * Record a change of the squeeze action, straight from the session event.
     *
     * @param edge The direction of the change.
     */
    _pushSqueezeEdge(edge: LXRButtonEdge): void {
        this.#pushEdge(this.#squeeze_edges, edge);
    }

    /**
     * @internal
     *
     * Refresh the state this source reports for a new frame: poll the gamepad, recompute the
     * component edges, and release one pending select and squeeze edge.
     *
     * @param frame The frame being processed.
     * @param reference_space The space poses are resolved in, or null when there is none yet.
     */
    _beginFrame({ frame, reference_space }: { frame: XRFrame; reference_space: XRReferenceSpace | null }): void {
        this.#frame = frame;
        this.#reference_space = reference_space;
        this.#is_target_ray_pose_resolved = false;
        this.#is_grip_pose_resolved = false;
        this.#target_ray_pose = null;
        this.#grip_pose = null;

        this.#select_event = this.#select_edges.shift() ?? "";
        if (this.#select_event !== "") {
            this.#select_active = this.#select_event === "down";
        }

        this.#squeeze_event = this.#squeeze_edges.shift() ?? "";
        if (this.#squeeze_event !== "") {
            this.#squeeze_active = this.#squeeze_event === "down";
        }

        this.#updateButtons();
        this.#updateComponents();
    }

    /**
     * @internal
     *
     * Drop everything the user agent invalidates once the frame is over.
     */
    _endFrame(): void {
        this.#frame = null;
        this.#reference_space = null;
        this.#target_ray_pose = null;
        this.#grip_pose = null;
        this.#is_target_ray_pose_resolved = false;
        this.#is_grip_pose_resolved = false;
    }

    /**
     * @internal
     *
     * Drop this source's state, for a source the session no longer reports or a session that ended.
     */
    _release(): void {
        this._endFrame();
        this.#motion_controller = null;
        this.#buttons.length = 0;
        this.#select_edges.length = 0;
        this.#squeeze_edges.length = 0;
        this.#select_active = false;
        this.#squeeze_active = false;
        this.#select_event = "";
        this.#squeeze_event = "";
    }

    /**
     * Fold the raw gamepad buttons into {@link #buttons}, deriving the press edges from the
     * previous frame's values.
     *
     * Independent of the profile, so an index-addressed binding works from the first frame and
     * keeps working on a device nothing could be fetched for.
     */
    #updateButtons(): void {
        const { gamepad } = this.xr_input_source;
        if (!gamepad) {
            return;
        }

        const { buttons } = gamepad;
        for (let index = 0; index < buttons.length; index++) {
            const { pressed, touched, value } = buttons[index];

            let state = this.#buttons[index];
            if (!state) {
                state = { index, pressed: false, touched: false, value: 0, event: "" };
                this.#buttons[index] = state;
            }

            state.event = state.pressed === pressed ? "" : pressed ? "down" : "up";
            state.pressed = pressed;
            state.touched = touched;
            state.value = value;
        }
    }

    /**
     * Poll the gamepad and fold the result into {@link components}, deriving the press edges from
     * the previous frame's values.
     */
    #updateComponents(): void {
        const motion_controller = this.#motion_controller;
        if (!motion_controller || !this.xr_input_source.gamepad) {
            return;
        }

        motion_controller.updateFromGamepad();

        for (const id of Object.keys(this.components)) {
            const state = this.components[id];

            // Widened to plain strings on the way in: the package declares the component state as a
            // string `const enum`, which TypeScript refuses to compare with — or assign to — the
            // string literals that same enum is made of.
            const values = motion_controller.components[id]?.values as
                | { state: LXRComponentPhase; button?: number; xAxis?: number; yAxis?: number }
                | undefined;
            if (!values) {
                continue;
            }

            const pressed = values.state === "pressed";
            state.event = state.pressed === pressed ? "" : pressed ? "down" : "up";
            state.state = values.state;
            state.pressed = pressed;
            // Unlike the raw gamepad button, which reports touched and pressed independently, the
            // profile state is exclusive — so "a finger is on it" is everything but `default`.
            state.touched = values.state !== "default";
            state.value = values.button ?? 0;
            state.x_axis = values.xAxis ?? 0;
            state.y_axis = values.yAxis ?? 0;
        }
    }

    /**
     * Queue one action edge, dropping the oldest if a consumer has stopped reading them.
     *
     * @param edges The queue to push onto.
     * @param edge The edge to record.
     */
    #pushEdge(edges: LXRButtonEdge[], edge: LXRButtonEdge): void {
        edges.push(edge);
        if (edges.length > MAX_PENDING_EDGES) {
            edges.shift();
        }
    }

    /**
     * Read a pose in the session reference space, without ever throwing: `getPose` throws outright
     * on spaces the user agent considers incompatible, and returns nothing whenever tracking is
     * lost, which is an ordinary frame rather than a failure.
     *
     * @param space The space to locate.
     * @returns The pose, or null when there is none for this frame.
     */
    #getPose(space: XRSpace): XRPose | null {
        const frame = this.#frame;
        const reference_space = this.#reference_space;
        if (!frame || !reference_space) {
            return null;
        }

        try {
            const pose = frame.getPose(space, reference_space) ?? null;
            this.#pose_error_log.reportSuccess();
            return pose;
        } catch (error) {
            this.#pose_error_log.report(`Could not read a pose for the ${this.handedness} XR input source`, error);
            return null;
        }
    }
}

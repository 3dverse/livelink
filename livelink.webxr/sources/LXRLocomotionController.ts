//------------------------------------------------------------------------------
import type { LXRCameraRig } from "./LXRCameraRig";
import { LXRFrameErrorLog } from "./LXRFrameLoop";
import {
    LXRAxisSmoother,
    LXRSnapTurn,
    type LXRAxisSmoothingOptions,
    type LXRSnapTurnOptions,
    type LXRTurnMode,
} from "./LXRComfort";
import {
    LXRStrafeMoveLocalSpace,
    LXRStrafeMoveWorldSpace,
    LXRThrustMoveLocalSpace,
    LXRThrustMoveWorldSpace,
    LXRVerticalMoveLocalSpace,
    LXRVerticalMoveWorldSpace,
    LXRYawRotationLocalSpace,
    LXRYawRotationWorldSpace,
    LXRYawSnapLocalSpace,
    LXRYawSnapWorldSpace,
} from "./LXRLocomotion";
import type { LXRActionMap } from "./input/LXRActionMap";

//------------------------------------------------------------------------------
/**
 * The four things virtual locomotion can do to the rig. One conditioner and one speed per axis.
 */
export type LXRLocomotionAxis = "strafe" | "thrust" | "vertical" | "yaw";

/**
 * Every locomotion axis, for iteration.
 */
export const LXR_LOCOMOTION_AXES: readonly LXRLocomotionAxis[] = ["strafe", "thrust", "vertical", "yaw"];

//------------------------------------------------------------------------------
/**
 * One frame's raw locomotion input, before any conditioning.
 *
 * The signs are the ones the underlying {@link LXRLocomotion} functions apply, not the ones a
 * thumbstick reports — a binding that reads a stick is responsible for the translation, which is
 * what {@link LXRLocomotionController._update} does for the action map:
 *
 * - `strafe` — positive moves right along the rig's local X.
 * - `thrust` — positive moves backwards along the rig's local Z, which is what a stick pulled
 *   *towards* the user reads as. This is the axis whose sign surprises people; it is the standard's
 *   `y_axis` convention (positive is down/back) carried through unchanged.
 * - `vertical` — positive moves up along world Y.
 * - `yaw` — positive turns *left*, being a positive rotation around world Y.
 */
export type LXRLocomotionAxes = Record<LXRLocomotionAxis, number>;

//------------------------------------------------------------------------------
/**
 * Which space one locomotion axis is applied in.
 *
 * `pose-local` moves the rig relative to where the user is looking, `world` relative to the world
 * axes. Translation on the horizontal plane wants the first — pushing a stick forward means
 * "forward from here" — while going up and turning want the second, since a head tilted down would
 * otherwise make "up" mean "backwards".
 */
export type LXRLocomotionSpace = "pose-local" | "world";

//------------------------------------------------------------------------------
/**
 * Default speeds, in scene units per second at {@link LXRLocomotionController.speed_scale} 1, except
 * yaw which is in degrees per second. They are the values the virtual joysticks and the physical
 * thumbsticks independently converged on before there was one controller to hold them.
 */
export const LXR_DEFAULT_STRAFE_SPEED = 2;
export const LXR_DEFAULT_THRUST_SPEED = 4;
export const LXR_DEFAULT_VERTICAL_SPEED = 2;
export const LXR_DEFAULT_YAW_SPEED = 40;

/**
 * Conditioned axis value under which no movement is applied. Small enough to be invisible; its only
 * job is to stop the rig transform being marked dirty on every frame of a ramp that has all but
 * finished.
 */
export const LXR_MIN_LOCOMOTION_VALUE = 0.001;

//------------------------------------------------------------------------------
/**
 * Everything between "the user is pushing a stick" and "the rig moves": one comfort conditioner per
 * axis, the snap turn, the speeds, and the spaces the movement is applied in.
 *
 * It exists because there were two of these. A physical thumbstick went through the app's own
 * smoothers, a virtual joystick through a per-hook smoother of its own, and the two paths drifted —
 * different deadzones in practice, different thresholds for "moving", and a snap turn that only one
 * of them had. Both now write the same {@link LXRLocomotionAxes} and the conditioning happens once,
 * here, on the frame it is applied:
 *
 * - the **action map** drives it automatically from {@link LXR_DEFAULT_ACTION_MAP}, which is what
 *   gives a consumer working locomotion on a headset without writing any of it;
 * - anything that is not an XR input source — a virtual joystick, a keyboard, a scripted move —
 *   writes through {@link setManualInput}, and the larger of the two wins per axis.
 *
 * Owned and driven by {@link XRLivelink}, once per frame, after the frame phases and immediately
 * before the rig composes its transforms. That ordering is deliberate: a consumer callback, and
 * later an in-headset pointer, gets to {@link LXRActionMap.consume} an action before locomotion
 * reads it, and the movement still lands on the frame that draws it.
 *
 * @experimental
 */
export class LXRLocomotionController {
    /**
     * The rig every movement is applied to.
     */
    readonly #camera_rig: LXRCameraRig;

    /**
     * One conditioner per axis: deadzone against stick drift, a shaped response for fine control
     * near centre, and a ramp so starts and stops have weight rather than being steps.
     *
     * They are stateful, so they are fed on *every* frame — including the ones where the axis is at
     * rest, which is the only thing that drives the ramp back down.
     */
    readonly #smoothers: Record<LXRLocomotionAxis, LXRAxisSmoother> = {
        strafe: new LXRAxisSmoother(),
        thrust: new LXRAxisSmoother(),
        vertical: new LXRAxisSmoother(),
        yaw: new LXRAxisSmoother(),
    };

    /**
     * Whether each axis is conditioned at all. False feeds the raw value straight through, which is
     * what a caller that has already conditioned its own input wants.
     */
    readonly #is_smoothing_enabled: Record<LXRLocomotionAxis, boolean> = {
        strafe: true,
        thrust: true,
        vertical: true,
        yaw: true,
    };

    /**
     * The discrete alternative to continuous turning, used when {@link turn_mode} is `snap`.
     */
    readonly #snap_turn = new LXRSnapTurn();

    /**
     * How the yaw axis turns the user. Defaulted per session mode by {@link XRLivelink.initialize}.
     */
    #turn_mode: LXRTurnMode = "smooth";

    /**
     * Per-axis speeds, before {@link speed_scale}.
     */
    readonly #speeds: Record<LXRLocomotionAxis, number> = {
        strafe: LXR_DEFAULT_STRAFE_SPEED,
        thrust: LXR_DEFAULT_THRUST_SPEED,
        vertical: LXR_DEFAULT_VERTICAL_SPEED,
        yaw: LXR_DEFAULT_YAW_SPEED,
    };

    /**
     * The space each axis is applied in. See {@link LXRLocomotionSpace} for why they differ.
     */
    readonly #spaces: Record<LXRLocomotionAxis, LXRLocomotionSpace> = {
        strafe: "pose-local",
        thrust: "pose-local",
        vertical: "world",
        yaw: "world",
    };

    /**
     * Scale applied on top of every speed. See {@link speed_scale}.
     */
    #speed_scale: number = 1;

    /**
     * Whether locomotion runs at all. See {@link enabled}.
     */
    #enabled: boolean = true;

    /**
     * What a non-XR input source is asking for, which persists until it is written again — a
     * joystick reports on pointer events, not on frames.
     */
    readonly #manual_input: LXRLocomotionAxes = { strafe: 0, thrust: 0, vertical: 0, yaw: 0 };

    /**
     * What the action map is asking for, refilled from scratch every frame.
     */
    readonly #action_input: LXRLocomotionAxes = { strafe: 0, thrust: 0, vertical: 0, yaw: 0 };

    /**
     * The two combined, as applied on the current frame. See {@link axes}.
     */
    readonly #axes: LXRLocomotionAxes = { strafe: 0, thrust: 0, vertical: 0, yaw: 0 };

    /**
     * Deduplicating log for the per-frame update, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * @param camera_rig The rig locomotion is applied to.
     */
    constructor({ camera_rig }: { camera_rig: LXRCameraRig }) {
        this.#camera_rig = camera_rig;
    }

    /**
     * Whether locomotion runs at all. Turn it off for a consumer that drives the rig itself, or for
     * a session where the user is not supposed to be able to leave the spot they are standing on.
     *
     * A disabled controller returns every conditioner to rest rather than freezing it, so re-enabling
     * it does not resume a ramp from wherever it was interrupted.
     */
    get enabled(): boolean {
        return this.#enabled;
    }

    /**
     * Enable or disable locomotion. See {@link enabled}.
     */
    set enabled(value: boolean) {
        this.#enabled = value;
    }

    /**
     * Scale applied on top of every axis speed, 1 being the speeds as configured.
     *
     * This is the knob for "how fast is fast" in a given scene — an application whose scene units
     * are centimetres and one whose units are kilometres want the same bindings and wildly different
     * speeds. Separate from the per-axis speeds so a speed-up binding can multiply the lot without
     * having to know what the four of them are.
     */
    get speed_scale(): number {
        return this.#speed_scale;
    }

    /**
     * Set the scale applied on top of every axis speed. See {@link speed_scale}.
     */
    set speed_scale(value: number) {
        this.#speed_scale = value;
    }

    /**
     * How the yaw axis turns the user — discrete steps or a continuous rotation. See
     * {@link LXRTurnMode}.
     *
     * Defaulted per session mode by {@link XRLivelink.initialize}: snap in a headset, where
     * continuous yaw is the single most reliable way to make someone sick, and smooth on a handheld
     * screen, where snapping a window in 45° steps reads as a bug. A consumer that wants something
     * else sets it after `initialize` resolves.
     */
    get turn_mode(): LXRTurnMode {
        return this.#turn_mode;
    }

    /**
     * Set how the yaw axis turns the user. See {@link turn_mode}.
     */
    set turn_mode(value: LXRTurnMode) {
        if (this.#turn_mode === value) {
            return;
        }

        this.#turn_mode = value;
        // Neither of the two mechanisms is fed while the other one is in charge, so both would
        // resume from whatever they held when the mode last changed: a ramp mid-throw, or a snap
        // still waiting to be re-armed by an axis that has long since returned to rest.
        this.#smoothers.yaw.reset();
        this.#snap_turn.reset();
    }

    /**
     * The snap turn, exposed so its angle and thresholds can be read. Use
     * {@link configureSnapTurn} to change them.
     */
    get snap_turn(): LXRSnapTurn {
        return this.#snap_turn;
    }

    /**
     * What is being asked of each axis on the current frame, after the manual and action inputs are
     * combined and before conditioning.
     *
     * Refilled in place every frame rather than rebuilt: read what is needed out of it, do not
     * retain it.
     */
    get axes(): Readonly<LXRLocomotionAxes> {
        return this.#axes;
    }

    /**
     * What the non-XR input channel is currently asking for. See {@link setManualInput}.
     */
    get manual_input(): Readonly<LXRLocomotionAxes> {
        return this.#manual_input;
    }

    /**
     * The speed of one axis, before {@link speed_scale}.
     *
     * @param axis The axis to read.
     */
    getSpeed(axis: LXRLocomotionAxis): number {
        return this.#speeds[axis];
    }

    /**
     * Set the speed of one axis, in scene units per second — degrees per second for `yaw`.
     *
     * @param axis The axis to configure.
     * @param speed The speed, before {@link speed_scale}.
     */
    setSpeed({ axis, speed }: { axis: LXRLocomotionAxis; speed: number }): void {
        this.#speeds[axis] = speed;
    }

    /**
     * The space one axis is applied in.
     *
     * @param axis The axis to read.
     */
    getSpace(axis: LXRLocomotionAxis): LXRLocomotionSpace {
        return this.#spaces[axis];
    }

    /**
     * Set the space one axis is applied in. See {@link LXRLocomotionSpace}.
     *
     * @param axis The axis to configure.
     * @param space The space to apply it in.
     */
    setSpace({ axis, space }: { axis: LXRLocomotionAxis; space: LXRLocomotionSpace }): void {
        this.#spaces[axis] = space;
    }

    /**
     * The live conditioner of one axis, so a caller can read its current value or tune it directly.
     *
     * @param axis The axis to read.
     */
    getSmoother(axis: LXRLocomotionAxis): LXRAxisSmoother {
        return this.#smoothers[axis];
    }

    /**
     * Retune the comfort conditioning, on one axis or on all four.
     *
     * @param axis The axis to configure. Omitted, every axis is configured.
     * @param smoothing The tuning to apply, or `false` to feed the raw axis straight through.
     */
    setSmoothing({ axis, smoothing }: { axis?: LXRLocomotionAxis; smoothing: LXRAxisSmoothingOptions | false }): void {
        const axes = axis ? [axis] : LXR_LOCOMOTION_AXES;

        for (const target of axes) {
            this.#is_smoothing_enabled[target] = smoothing !== false;
            if (smoothing !== false) {
                this.#smoothers[target].configure(smoothing);
            }
        }
    }

    /**
     * Retune the snap turn. See {@link LXRSnapTurn}.
     *
     * @param options The tuning to apply; anything omitted keeps its current value.
     */
    configureSnapTurn(options: LXRSnapTurnOptions): void {
        this.#snap_turn.configure(options);
    }

    /**
     * Drive locomotion from something that is not an XR input source — a virtual joystick, a
     * keyboard, a scripted move.
     *
     * The values persist until they are written again, since the things that produce them report on
     * their own events rather than once per frame. Whichever of this and the action map is asking
     * for more wins on each axis independently, so a joystick and a thumbstick do not fight, they
     * take turns.
     *
     * @param axes The axes to set, in the conventions of {@link LXRLocomotionAxes}. Anything omitted
     * keeps its current value — pass 0 to release an axis, which is what a joystick's `onEnd` does.
     */
    setManualInput(axes: Partial<LXRLocomotionAxes>): void {
        for (const axis of LXR_LOCOMOTION_AXES) {
            const value = axes[axis];
            if (value !== undefined) {
                this.#manual_input[axis] = value;
            }
        }
    }

    /**
     * Drive one axis from something that is not an XR input source. See {@link setManualInput}.
     *
     * @param axis The axis to drive.
     * @param value The raw value, in the conventions of {@link LXRLocomotionAxes}. 0 releases it.
     */
    setAxisInput({ axis, value }: { axis: LXRLocomotionAxis; value: number }): void {
        this.#manual_input[axis] = value;
    }

    /**
     * Release every axis of the non-XR input channel. See {@link setManualInput}.
     */
    clearManualInput(): void {
        for (const axis of LXR_LOCOMOTION_AXES) {
            this.#manual_input[axis] = 0;
        }
    }

    /**
     * @internal
     *
     * Read this frame's actions, condition them, and move the rig.
     *
     * @param dt Seconds since the previous XR frame, 0 on the first one.
     * @param actions The actions resolved for this frame.
     */
    _update({ dt, actions }: { dt: number; actions: LXRActionMap }): void {
        try {
            if (!this.#enabled) {
                this.#returnToRest();
                return;
            }

            this.#readActions(actions);
            this.#combineInputs();

            this.#applyHorizontalMove(dt);
            this.#applyVerticalMove(dt);
            this.#applyTurn(dt);

            this.#error_log.reportSuccess();
        } catch (error) {
            // Never rethrown into the frame loop: a frame that could not be moved is a frame the
            // user did not move on, not a reason to skip the draw and freeze the view.
            this.#error_log.report("Skipped an XR locomotion update", error);
        }
    }

    /**
     * @internal
     *
     * Return every conditioner and every input to rest, for a session that is ending or one that is
     * about to start. The configuration — speeds, spaces, tuning, turn mode — is the consumer's, not
     * session state, and is kept.
     */
    _reset(): void {
        this.#returnToRest();
        this.clearManualInput();
    }

    /**
     * Drop the conditioners, the snap turn and this frame's resolved axes back to rest, without
     * touching what a consumer has written through {@link setManualInput}.
     */
    #returnToRest(): void {
        for (const axis of LXR_LOCOMOTION_AXES) {
            this.#smoothers[axis].reset();
            this.#action_input[axis] = 0;
            this.#axes[axis] = 0;
        }
        this.#snap_turn.reset();
    }

    /**
     * Translate this frame's actions into raw axes.
     *
     * @param actions The actions resolved for this frame.
     */
    #readActions(actions: LXRActionMap): void {
        const move = actions.getAxis("move");
        this.#action_input.strafe = move.x;
        this.#action_input.thrust = move.y;

        // The action reports a stick, where positive is right; the axis is a rotation around world
        // Y, where positive is left. This is the one place that translation belongs.
        this.#action_input.yaw = -actions.getAxis("turn").x;

        // Up wins when both are held, rather than cancelling: releasing one of two buttons should
        // leave the movement the other one asks for, not start it.
        const is_rising = actions.getButton("rise").active;
        const is_sinking = actions.getButton("sink").active;
        this.#action_input.vertical = is_rising ? 1 : is_sinking ? -1 : 0;
    }

    /**
     * Resolve each axis to whichever channel is asking for more of it.
     */
    #combineInputs(): void {
        for (const axis of LXR_LOCOMOTION_AXES) {
            const manual = this.#manual_input[axis];
            const action = this.#action_input[axis];
            this.#axes[axis] = Math.abs(manual) > Math.abs(action) ? manual : action;
        }
    }

    /**
     * Condition one axis for this frame.
     *
     * Called for every axis on every frame, at rest included: the conditioner is a stateful ramp,
     * and one only fed while a stick is pushed can never come back down.
     *
     * @param axis The axis to condition.
     * @param dt Seconds since the previous XR frame.
     * @returns The conditioned value to move by.
     */
    #condition(axis: LXRLocomotionAxis, dt: number): number {
        const raw = this.#axes[axis];
        if (!this.#is_smoothing_enabled[axis]) {
            return raw;
        }

        return this.#smoothers[axis].update(raw, dt);
    }

    /**
     * Strafe and thrust, on the horizontal plane.
     *
     * @param dt Seconds since the previous XR frame.
     */
    #applyHorizontalMove(dt: number): void {
        // Conditioned before the early return on `dt`, so the first frame of a session — which has
        // no previous timestamp to measure against — still feeds the ramps.
        const strafe = this.#condition("strafe", dt);
        const thrust = this.#condition("thrust", dt);
        if (dt <= 0) {
            return;
        }

        if (Math.abs(strafe) >= LXR_MIN_LOCOMOTION_VALUE) {
            const move = this.#spaces.strafe === "world" ? LXRStrafeMoveWorldSpace : LXRStrafeMoveLocalSpace;
            move({ camera_rig: this.#camera_rig, value: strafe, dt, speed: this.#scaledSpeed("strafe") });
        }

        if (Math.abs(thrust) >= LXR_MIN_LOCOMOTION_VALUE) {
            const move = this.#spaces.thrust === "world" ? LXRThrustMoveWorldSpace : LXRThrustMoveLocalSpace;
            move({ camera_rig: this.#camera_rig, value: thrust, dt, speed: this.#scaledSpeed("thrust") });
        }
    }

    /**
     * Vertical movement.
     *
     * @param dt Seconds since the previous XR frame.
     */
    #applyVerticalMove(dt: number): void {
        const vertical = this.#condition("vertical", dt);
        if (dt <= 0 || Math.abs(vertical) < LXR_MIN_LOCOMOTION_VALUE) {
            return;
        }

        const move = this.#spaces.vertical === "world" ? LXRVerticalMoveWorldSpace : LXRVerticalMoveLocalSpace;
        move({ camera_rig: this.#camera_rig, value: vertical, dt, speed: this.#scaledSpeed("vertical") });
    }

    /**
     * Turning, snapped or continuous.
     *
     * @param dt Seconds since the previous XR frame.
     */
    #applyTurn(dt: number): void {
        if (this.#turn_mode === "snap") {
            // Fed on every frame including the ones at rest, and *not* gated on `dt`: the axis has
            // to be seen returning to rest for the next snap to arm, and a snap is a step rather
            // than a rate, so it is the one movement a frame with no measurable duration can carry.
            const angle = this.#snap_turn.update(this.#axes.yaw);
            if (angle === 0) {
                return;
            }

            const snap = this.#spaces.yaw === "world" ? LXRYawSnapWorldSpace : LXRYawSnapLocalSpace;
            snap({ camera_rig: this.#camera_rig, angle });
            return;
        }

        const yaw = this.#condition("yaw", dt);
        if (dt <= 0 || Math.abs(yaw) < LXR_MIN_LOCOMOTION_VALUE) {
            return;
        }

        const rotate = this.#spaces.yaw === "world" ? LXRYawRotationWorldSpace : LXRYawRotationLocalSpace;
        rotate({ camera_rig: this.#camera_rig, value: yaw, dt, speed: this.#scaledSpeed("yaw") });
    }

    /**
     * One axis' speed with {@link speed_scale} applied.
     *
     * @param axis The axis to read.
     */
    #scaledSpeed(axis: LXRLocomotionAxis): number {
        return this.#speeds[axis] * this.#speed_scale;
    }
}

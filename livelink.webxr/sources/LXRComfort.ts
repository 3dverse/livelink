//------------------------------------------------------------------------------
/**
 * Motion comfort primitives for XR locomotion.
 *
 * Raw stick axes are not usable as movement input: they never rest exactly at zero, they reach
 * full throw instantly, and a continuous yaw driven straight off one is the single most reliable
 * way to make someone sick in a headset. Everything here conditions a raw axis into something a
 * body tolerates — a deadzone, a ramp in and out, and a discrete alternative to smooth turning.
 *
 * The primitives are deliberately transport-agnostic: the same {@link LXRAxisSmoother} conditions a
 * virtual joystick on a phone and a physical thumbstick on a headset controller. Both are stateful
 * (one instance per axis) and allocation-free once constructed, since they run inside the XR frame
 * loop.
 *
 * @experimental
 */

//------------------------------------------------------------------------------
/**
 * Fraction of the throw, from either end of the axis, treated as rest.
 *
 * Sized for a physical thumbstick, which rests a few percent off centre and drifts further as it
 * wears. A virtual joystick is exact at rest and could use less, but the same value there also buys
 * the fine control of the shaped response near centre.
 */
export const LXR_DEFAULT_DEADZONE = 0.15;

/**
 * Seconds a conditioned axis takes to travel the full throw when it is being pushed.
 */
export const LXR_DEFAULT_ACCELERATION_TIME = 0.2;

/**
 * Seconds a conditioned axis takes to travel the full throw when it is returning to rest.
 *
 * Shorter than the acceleration: a stop that lags behind the stick reads as the controls being
 * unresponsive, while a start that ramps reads as weight.
 */
export const LXR_DEFAULT_DECELERATION_TIME = 0.12;

/**
 * Exponent applied to the post-deadzone throw. Above 1 it trades resolution at the top of the
 * range, where nobody is aiming, for resolution at the bottom, where fine positioning happens.
 */
export const LXR_DEFAULT_RESPONSE_EXPONENT = 1.6;

/**
 * Below this the ramp is considered arrived, so a released stick settles at exactly zero instead of
 * approaching it forever and leaving the camera drifting by fractions of a millimetre per frame.
 */
const RESIDUAL_EPSILON = 1e-4;

/**
 * Longest frame delta the ramps will honour, in seconds. A tab that was backgrounded, or a frame
 * that took a garbage collection, would otherwise resume with a delta large enough to make the ramp
 * a step.
 */
const MAX_RAMP_DELTA_SECONDS = 0.1;

//------------------------------------------------------------------------------
/**
 * Tuning of an {@link LXRAxisSmoother}. Every field is optional; omitted ones keep their current
 * value, so a partial object reconfigures only what it names.
 */
export type LXRAxisSmoothingOptions = {
    /**
     * Fraction of the throw treated as rest, in `[0, 1)`. See {@link LXR_DEFAULT_DEADZONE}.
     */
    deadzone?: number;

    /**
     * Seconds to travel the full throw while being pushed. 0 disables the ramp in that direction.
     */
    acceleration_time?: number;

    /**
     * Seconds to travel the full throw while returning to rest. 0 disables the ramp in that
     * direction.
     */
    deceleration_time?: number;

    /**
     * Exponent applied to the post-deadzone throw. 1 is linear.
     */
    response_exponent?: number;
};

//------------------------------------------------------------------------------
/**
 * Conditions one raw axis into a movement value: deadzone, shaped response, and a rate-limited ramp
 * in and out.
 *
 * One instance per axis, updated once per frame with the current raw value — including the frames
 * where it is zero, which is what lets the ramp out run at all.
 *
 * @experimental
 */
export class LXRAxisSmoother {
    /**
     * Fraction of the throw treated as rest.
     */
    #deadzone: number = LXR_DEFAULT_DEADZONE;

    /**
     * Seconds to travel the full throw while being pushed.
     */
    #acceleration_time: number = LXR_DEFAULT_ACCELERATION_TIME;

    /**
     * Seconds to travel the full throw while returning to rest.
     */
    #deceleration_time: number = LXR_DEFAULT_DECELERATION_TIME;

    /**
     * Exponent applied to the post-deadzone throw.
     */
    #response_exponent: number = LXR_DEFAULT_RESPONSE_EXPONENT;

    /**
     * Current conditioned value, which the ramp moves towards the conditioned raw value.
     */
    #value: number = 0;

    /**
     * @param options Initial tuning; anything omitted keeps its default.
     */
    constructor(options: LXRAxisSmoothingOptions = {}) {
        this.configure(options);
    }

    /**
     * The conditioned value as of the last {@link update}.
     */
    get value(): number {
        return this.#value;
    }

    /**
     * Retune the smoother. Only the named fields change; the current ramp position is preserved, so
     * this is safe to call from a React effect on every options change.
     *
     * @param options The tuning to apply.
     */
    configure({ deadzone, acceleration_time, deceleration_time, response_exponent }: LXRAxisSmoothingOptions): void {
        if (deadzone !== undefined) {
            this.#deadzone = Math.min(Math.max(deadzone, 0), 0.99);
        }
        if (acceleration_time !== undefined) {
            this.#acceleration_time = Math.max(acceleration_time, 0);
        }
        if (deceleration_time !== undefined) {
            this.#deceleration_time = Math.max(deceleration_time, 0);
        }
        if (response_exponent !== undefined) {
            this.#response_exponent = Math.max(response_exponent, 0.01);
        }
    }

    /**
     * Drop the ramp back to rest. Call when the session ends or the input is detached, so the next
     * one does not inherit a value from the last.
     */
    reset(): void {
        this.#value = 0;
    }

    /**
     * Advance the ramp one frame.
     *
     * @param raw The raw axis value, nominally in `[-1, 1]`.
     * @param dt Seconds since the previous call.
     * @returns The conditioned value to drive locomotion with.
     */
    update(raw: number, dt: number): number {
        const target = this.#applyDeadzone(raw);

        // The ramp is expressed per second, so it cannot run on the first frame of a loop, where
        // there is no previous timestamp to measure against.
        if (!(dt > 0)) {
            return this.#value;
        }

        // A ramp is only a ramp while it stays ahead of the stick. Rising and falling get their own
        // durations because they are perceived differently — see LXR_DEFAULT_DECELERATION_TIME.
        const ramp_time = Math.abs(target) > Math.abs(this.#value) ? this.#acceleration_time : this.#deceleration_time;
        if (ramp_time === 0) {
            this.#value = target;
            return this.#value;
        }

        const delta = target - this.#value;
        const max_delta = Math.min(dt, MAX_RAMP_DELTA_SECONDS) / ramp_time;
        this.#value += Math.abs(delta) <= max_delta ? delta : Math.sign(delta) * max_delta;

        if (target === 0 && Math.abs(this.#value) < RESIDUAL_EPSILON) {
            this.#value = 0;
        }

        return this.#value;
    }

    /**
     * Remove the deadzone and shape what is left, so the conditioned value still spans the whole
     * `[-1, 1]` range rather than starting at the deadzone edge.
     *
     * @param raw The raw axis value.
     * @returns The conditioned target for the ramp.
     */
    #applyDeadzone(raw: number): number {
        const magnitude = Math.abs(raw);
        if (magnitude <= this.#deadzone) {
            return 0;
        }

        const throw_fraction = Math.min((magnitude - this.#deadzone) / (1 - this.#deadzone), 1);
        return Math.sign(raw) * Math.pow(throw_fraction, this.#response_exponent);
    }
}

//------------------------------------------------------------------------------
/**
 * Degrees turned by one snap. 45° is the common default: large enough that four of them face you
 * the other way, small enough not to lose your bearings.
 */
export const LXR_DEFAULT_SNAP_TURN_ANGLE = 45;

/**
 * Throw at which a snap fires.
 */
export const LXR_DEFAULT_SNAP_TURN_THRESHOLD = 0.6;

/**
 * Throw the axis must fall back under before another snap can fire. Deliberately well below
 * {@link LXR_DEFAULT_SNAP_TURN_THRESHOLD}: a stick held near the trigger point would otherwise
 * chatter across it.
 */
export const LXR_DEFAULT_SNAP_TURN_RELEASE_THRESHOLD = 0.3;

//------------------------------------------------------------------------------
/**
 * Tuning of an {@link LXRSnapTurn}.
 */
export type LXRSnapTurnOptions = {
    /**
     * Degrees turned by one snap.
     */
    angle?: number;

    /**
     * Throw at which a snap fires.
     */
    threshold?: number;

    /**
     * Throw the axis must fall back under before another snap can fire.
     */
    release_threshold?: number;
};

//------------------------------------------------------------------------------
/**
 * Turns one raw axis into discrete rotation steps.
 *
 * Continuous yaw is the classic way to make someone sick in VR: the eyes report a rotation the
 * inner ear does not. A snap replaces the rotation with a jump, which reports nothing at all.
 *
 * The axis must return to rest between snaps — holding the stick over does not repeat. That is the
 * convention on every headset shipping snap turn, and it is what makes a snap a deliberate act
 * rather than something you drift into.
 *
 * @experimental
 */
export class LXRSnapTurn {
    /**
     * Degrees turned by one snap.
     */
    #angle: number = LXR_DEFAULT_SNAP_TURN_ANGLE;

    /**
     * Throw at which a snap fires.
     */
    #threshold: number = LXR_DEFAULT_SNAP_TURN_THRESHOLD;

    /**
     * Throw the axis must fall back under to re-arm.
     */
    #release_threshold: number = LXR_DEFAULT_SNAP_TURN_RELEASE_THRESHOLD;

    /**
     * Whether the axis has been at rest since the last snap.
     */
    #is_armed: boolean = true;

    /**
     * @param options Initial tuning; anything omitted keeps its default.
     */
    constructor(options: LXRSnapTurnOptions = {}) {
        this.configure(options);
    }

    /**
     * Retune the snap. Only the named fields change.
     *
     * @param options The tuning to apply.
     */
    configure({ angle, threshold, release_threshold }: LXRSnapTurnOptions): void {
        if (angle !== undefined) {
            this.#angle = angle;
        }
        if (threshold !== undefined) {
            this.#threshold = threshold;
        }
        if (release_threshold !== undefined) {
            this.#release_threshold = release_threshold;
        }
    }

    /**
     * Re-arm and forget the current axis state.
     */
    reset(): void {
        this.#is_armed = true;
    }

    /**
     * Feed the current raw axis value.
     *
     * @param raw The raw axis value, nominally in `[-1, 1]`.
     * @returns The signed angle in degrees to turn on this frame, or 0 on the frames — the vast
     * majority — where nothing fires.
     */
    update(raw: number): number {
        const magnitude = Math.abs(raw);

        if (magnitude < this.#release_threshold) {
            this.#is_armed = true;
            return 0;
        }

        if (!this.#is_armed || magnitude < this.#threshold) {
            return 0;
        }

        this.#is_armed = false;
        return Math.sign(raw) * this.#angle;
    }
}

//------------------------------------------------------------------------------
/**
 * How the yaw axis turns the user.
 *
 * - `snap` — discrete steps, the comfortable option, see {@link LXRSnapTurn}.
 * - `smooth` — continuous rotation, the nauseating one, kept because it is the right answer on a
 *   handheld screen where there is no vection to speak of.
 */
export type LXRTurnMode = "snap" | "smooth";

//------------------------------------------------------------------------------
/**
 * Turn mode that suits an XR session mode.
 *
 * `immersive-vr` is the only one that gets snap turning. That is the case the comfort literature is
 * about: the display fills the field of view, so a rotation the inner ear cannot corroborate has
 * nothing to argue with. A phone held at arm's length in AR is a window — the room around it is a
 * fixed reference the eyes keep seeing — and snapping a window in 45° steps reads as a bug rather
 * than a comfort feature.
 *
 * @param xr_mode The session mode.
 * @returns The turn mode to default to for that session.
 */
export function defaultTurnModeForSessionMode(xr_mode: XRSessionMode): LXRTurnMode {
    return xr_mode === "immersive-vr" ? "snap" : "smooth";
}

//------------------------------------------------------------------------------
/**
 * Strength of the comfort vignette applied while the user moves under virtual locomotion, from 0
 * (off) to 1 (the aperture closes to a narrow tunnel). See
 * {@link XRLivelink.comfort_vignette_strength}.
 */
export const LXR_DEFAULT_COMFORT_VIGNETTE_STRENGTH = 0.7;

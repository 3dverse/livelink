//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";

//------------------------------------------------------------------------------
import { WebXRContext } from "./WebXRContext";
import type { LXRCameraRig } from "../LXRCameraRig";
import { LXRAxisSmoother, type LXRAxisSmoothingOptions, type LXRTurnMode } from "../LXRComfort";
import {
    LXR_MIN_LOCOMOTION_VALUE,
    type LXRLocomotionAxis,
    type LXRLocomotionController,
    type LXRLocomotionSpace,
} from "../LXRLocomotionController";

//------------------------------------------------------------------------------
/**
 * Callback function type for XR animations
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param dt - Time elapsed since last frame in seconds
 */
export type XRAnimationCallback = ({
    camera_rig,
    value,
    speed,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}) => void;

//------------------------------------------------------------------------------
/**
 * Run a callback on every frame of the active XR session, with the elapsed time since the previous
 * one.
 *
 * It registers in the session's `input` phase rather than arming a `requestAnimationFrame` of its
 * own: each hook using this used to start a chain of its own — four sticks meant four chains on top
 * of the render loop — and their order against the draw was whatever the user agent decided. See
 * {@link XRLivelink.addFrameCallback}.
 *
 * The callback is held in a ref, so passing an inline closure neither re-registers on every render
 * nor leaves it calling a stale one.
 *
 * @param onFrame - Called once per XR frame with the frame delta in seconds — 0 on the first frame,
 * where there is no previous timestamp to measure against.
 * @param enabled - Whether to run at all. A disabled loop registers no frame callback rather than
 * registering one that does nothing.
 */
export function useXRFrameLoop(onFrame: (dt: number, frame: XRFrame) => void, { enabled = true } = {}): void {
    //--------------------------------------------------------------------------
    const { xrLivelink } = useContext(WebXRContext);
    const onFrameRef = useRef(onFrame);
    onFrameRef.current = onFrame;

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!xrLivelink || !enabled) {
            return;
        }

        return xrLivelink.addFrameCallback({
            phase: "input",
            callback: ({ dt, frame }) => onFrameRef.current(dt, frame),
        });
    }, [xrLivelink, enabled]);
}

//------------------------------------------------------------------------------
/**
 * Options shared by every continuous locomotion hook.
 */
export type XRLocomotionOptions = {
    /**
     * Speed multiplier for the animation.
     */
    speed?: number;

    /**
     * Whether the movement is applied in pose-local space rather than world space.
     */
    inPoseLocalSpace?: boolean;

    /**
     * Comfort conditioning applied to the raw axis: deadzone, shaped response, and a ramp in and
     * out. Pass `false` to feed the axis straight through, which is what these hooks did before the
     * conditioning existed.
     */
    smoothing?: LXRAxisSmoothingOptions | false;
};

//------------------------------------------------------------------------------
/**
 * Generic hook for XR animations driven by a continuous value.
 * Runs in the session's `input` phase, so it stays in sync with the XR display refresh rate and is
 * applied ahead of the frame that draws it. See {@link useXRFrameLoop}.
 *
 * This is the escape hatch for an arbitrary per-frame effect, and the one locomotion hook that does
 * *not* go through {@link LXRLocomotionController}: it carries a conditioner of its own, so a value
 * driven through it neither competes with a thumbstick nor obeys the controller's speed scale. The
 * axis hooks below are what a virtual joystick should use.
 *
 * The raw value handed to {@link update} is conditioned before it reaches the callback — a deadzone
 * so a stick that does not rest at zero does not creep, and a ramp so starts and stops have weight
 * instead of being steps. That is also why the loop keeps calling the smoother on frames where the
 * raw value is zero: the ramp out only exists if something drives it.
 *
 * @param callback - The animation callback to execute on each frame
 * @param speed - Speed multiplier for the animation (optional)
 * @param options - Comfort conditioning, and whether the loop runs at all
 * @returns Object with update function to set the animation value
 */
export function useXRLivelinkAnimation(
    callback: XRAnimationCallback,
    speed?: number,
    { smoothing, enabled = true }: { smoothing?: LXRAxisSmoothingOptions | false; enabled?: boolean } = {},
): {
    update: (value: number) => void;
} {
    //--------------------------------------------------------------------------
    const { xrLivelink } = useContext(WebXRContext);
    const valueRef = useRef(0);

    //--------------------------------------------------------------------------
    // One smoother per axis, kept across renders since it is the ramp's only memory.
    const smootherRef = useRef<LXRAxisSmoother | null>(null);
    smootherRef.current ??= new LXRAxisSmoother();

    //--------------------------------------------------------------------------
    // Destructured so the effect below depends on numbers rather than on the identity of an options
    // object the caller almost certainly rebuilds on every render.
    const isSmoothingEnabled = smoothing !== false;
    const { deadzone, acceleration_time, deceleration_time, response_exponent } = smoothing || {};

    useEffect(() => {
        smootherRef.current?.configure({ deadzone, acceleration_time, deceleration_time, response_exponent });
    }, [deadzone, acceleration_time, deceleration_time, response_exponent]);

    //--------------------------------------------------------------------------
    const onFrame = useCallback(
        (dt: number) => {
            const smoother = smootherRef.current!;
            const value = isSmoothingEnabled ? smoother.update(valueRef.current, dt) : valueRef.current;

            if (!xrLivelink || Math.abs(value) < LXR_MIN_LOCOMOTION_VALUE) {
                return;
            }

            callback({ camera_rig: xrLivelink.camera_rig, value, speed, dt });
        },
        [xrLivelink, callback, speed, isSmoothingEnabled],
    );

    useXRFrameLoop(onFrame, { enabled });

    //--------------------------------------------------------------------------
    // The ramp must not carry over from one session to the next.
    useEffect(() => {
        const smoother = smootherRef.current;
        return (): void => {
            valueRef.current = 0;
            smoother?.reset();
        };
    }, [xrLivelink]);

    //--------------------------------------------------------------------------
    const update = useCallback((value: number) => {
        valueRef.current = value;
    }, []);

    //--------------------------------------------------------------------------
    return useMemo(() => ({ update }), [update]);
}

//------------------------------------------------------------------------------
/**
 * The session's locomotion controller, or undefined outside a session.
 */
function useLocomotionController(): LXRLocomotionController | undefined {
    const { xrLivelink } = useContext(WebXRContext);
    return xrLivelink?.locomotion;
}

//------------------------------------------------------------------------------
/**
 * Drive one axis of {@link LXRLocomotionController} from React.
 *
 * The hook configures the axis and returns an `update` that writes the controller's manual input;
 * the conditioning, the speed scale and the move itself happen in the session's frame loop, in the
 * same place a physical thumbstick's do. That is the whole point of routing through the controller:
 * a virtual joystick and a thumbstick are two ways of asking for the same movement, and before this
 * they were two implementations of it.
 *
 * @param axis - The axis to drive
 * @param speed - Speed for that axis. Left undefined the controller's own default stands.
 * @param space - Space to apply it in. Left undefined the controller's own default stands.
 * @param smoothing - Comfort conditioning for that axis, or `false` to feed it straight through
 */
function useXRLocomotionAxis({
    axis,
    speed,
    space,
    smoothing,
}: {
    axis: LXRLocomotionAxis;
    speed?: number;
    space?: LXRLocomotionSpace;
    smoothing?: LXRAxisSmoothingOptions | false;
}): {
    update: (value: number) => void;
} {
    //--------------------------------------------------------------------------
    const locomotion = useLocomotionController();

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (locomotion && speed !== undefined) {
            locomotion.setSpeed({ axis, speed });
        }
    }, [locomotion, axis, speed]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (locomotion && space !== undefined) {
            locomotion.setSpace({ axis, space });
        }
    }, [locomotion, axis, space]);

    //--------------------------------------------------------------------------
    // Destructured so the effect depends on numbers rather than on the identity of an options object
    // the caller almost certainly rebuilds on every render.
    const isSmoothingEnabled = smoothing !== false;
    const { deadzone, acceleration_time, deceleration_time, response_exponent } = smoothing || {};

    useEffect(() => {
        if (!locomotion || smoothing === undefined) {
            return;
        }

        locomotion.setSmoothing({
            axis,
            smoothing: isSmoothingEnabled
                ? { deadzone, acceleration_time, deceleration_time, response_exponent }
                : false,
        });
        // `smoothing` itself is deliberately not a dependency: it is the object the fields above were
        // destructured out of, and depending on it would reconfigure on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locomotion, axis, isSmoothingEnabled, deadzone, acceleration_time, deceleration_time, response_exponent]);

    //--------------------------------------------------------------------------
    // An axis left pushed by a control that has gone away would keep the user moving forever.
    useEffect(() => {
        return (): void => locomotion?.setAxisInput({ axis, value: 0 });
    }, [locomotion, axis]);

    //--------------------------------------------------------------------------
    const update = useCallback(
        (value: number) => {
            locomotion?.setAxisInput({ axis, value });
        },
        [locomotion, axis],
    );

    //--------------------------------------------------------------------------
    return useMemo(() => ({ update }), [update]);
}

//------------------------------------------------------------------------------
/**
 * Hook for left/right strafe movement. Positive moves right.
 */
export function useXRStrafeMove({ speed, inPoseLocalSpace = true, smoothing }: XRLocomotionOptions = {}): {
    update: (value: number) => void;
} {
    return useXRLocomotionAxis({
        axis: "strafe",
        speed,
        space: inPoseLocalSpace ? "pose-local" : "world",
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for forward/backward thrust movement. Positive moves *backwards*, which is what a stick
 * pulled towards the user reports — see {@link LXRLocomotionAxes}.
 */
export function useXRThrustMove({ speed, inPoseLocalSpace = true, smoothing }: XRLocomotionOptions = {}): {
    update: (value: number) => void;
} {
    return useXRLocomotionAxis({
        axis: "thrust",
        speed,
        space: inPoseLocalSpace ? "pose-local" : "world",
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for world vertical movement (up/down on world Y axis). Positive moves up.
 */
export function useXRVerticalMove({ speed, inPoseLocalSpace = false, smoothing }: XRLocomotionOptions = {}): {
    update: (value: number) => void;
} {
    return useXRLocomotionAxis({
        axis: "vertical",
        speed,
        space: inPoseLocalSpace ? "pose-local" : "world",
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for discrete yaw rotation — one fixed step per stick push, the comfortable alternative to
 * continuous turning. See {@link LXRSnapTurn}.
 *
 * It puts the controller in `snap` turn mode for as long as it is mounted, since calling it is an
 * explicit request for snapped turning; {@link useXRYawRotation} is the hook to use when the mode
 * should follow the session or a setting.
 *
 * The axis has to fall back to rest before another snap fires, which means {@link update} must keep
 * being called — a joystick's `onEnd` handler passing 0 is what re-arms it.
 *
 * @param angle - Degrees per snap
 * @param threshold - Throw at which a snap fires
 * @param releaseThreshold - Throw the axis must fall back under before the next snap can fire
 * @param inPoseLocalSpace - Whether the rotation is applied in pose-local space rather than world space
 */
export function useXRSnapTurn({
    angle,
    threshold,
    releaseThreshold,
    inPoseLocalSpace = false,
}: {
    angle?: number;
    threshold?: number;
    releaseThreshold?: number;
    inPoseLocalSpace?: boolean;
} = {}): {
    update: (value: number) => void;
} {
    //--------------------------------------------------------------------------
    const locomotion = useLocomotionController();

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (locomotion) {
            locomotion.turn_mode = "snap";
        }
    }, [locomotion]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        locomotion?.configureSnapTurn({ angle, threshold, release_threshold: releaseThreshold });
    }, [locomotion, angle, threshold, releaseThreshold]);

    //--------------------------------------------------------------------------
    return useXRLocomotionAxis({ axis: "yaw", space: inPoseLocalSpace ? "pose-local" : "world" });
}

//------------------------------------------------------------------------------
/**
 * Hook for yaw rotation (left/right on world Y axis), continuous or snapped. Positive turns left.
 *
 * @param speed - Speed multiplier, continuous turning only
 * @param inPoseLocalSpace - Whether the rotation is applied in pose-local space rather than world space
 * @param turnMode - `snap` or `smooth`. Left undefined the controller keeps the mode
 * {@link XRLivelink.initialize} defaulted from the session, which snaps in a headset and turns
 * smoothly on a handheld screen.
 * @param snapAngle - Degrees per snap, snapped turning only
 * @param smoothing - Comfort conditioning of the axis, continuous turning only
 */
export function useXRYawRotation({
    speed,
    inPoseLocalSpace = false,
    turnMode,
    snapAngle,
    smoothing,
}: XRLocomotionOptions & { turnMode?: LXRTurnMode; snapAngle?: number } = {}): {
    update: (value: number) => void;
} {
    //--------------------------------------------------------------------------
    const locomotion = useLocomotionController();

    //--------------------------------------------------------------------------
    // Only when asked for: left alone, the session default stands. Snapped or smooth is now the
    // controller's single answer for the whole session rather than this hook's, so a thumbstick and
    // a joystick cannot disagree about it.
    useEffect(() => {
        if (locomotion && turnMode !== undefined) {
            locomotion.turn_mode = turnMode;
        }
    }, [locomotion, turnMode]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (locomotion && snapAngle !== undefined) {
            locomotion.configureSnapTurn({ angle: snapAngle });
        }
    }, [locomotion, snapAngle]);

    //--------------------------------------------------------------------------
    return useXRLocomotionAxis({
        axis: "yaw",
        speed,
        space: inPoseLocalSpace ? "pose-local" : "world",
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for a test animation that moves vertically from 1 to 5 and rotates 360° on world Y axis.
 * Triggers on the first call to `update()` and runs over a fixed duration.
 *
 * @param duration - Duration of the animation in seconds (default: 4)
 */
function _useXRWorldSpaceTestAnim({
    duration = 4,
    inPoseLocalSpace = false,
}: { duration?: number; inPoseLocalSpace?: boolean } = {}): {
    update: (value: number) => void;
} {
    const { xrLivelink } = useContext(WebXRContext);
    const animationFrameRef = useRef<number>(0);
    const elapsedRef = useRef(0);
    const lastTimeRef = useRef<DOMHighResTimeStamp>(0);
    const runningRef = useRef(false);
    const valueRef = useRef(0);

    const stop = useCallback(() => {
        if (animationFrameRef.current && xrLivelink?.xr_session) {
            xrLivelink.xr_session.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = 0;
        }
        runningRef.current = false;
    }, [xrLivelink]);

    const start = useCallback(() => {
        const xr_session = xrLivelink?.xr_session;
        if (!xrLivelink?.camera_rig || !xr_session || runningRef.current) {
            return;
        }

        runningRef.current = true;
        lastTimeRef.current = 0;

        // const animate = (time: DOMHighResTimeStamp, _frame: XRFrame): void => {
        lastTimeRef.current = performance.now();
        setInterval(() => {
            if (!runningRef.current) {
                return;
            }

            const time = performance.now();
            const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
            lastTimeRef.current = time;
            elapsedRef.current += dt;

            // Ping-pong: forward then backward within each cycle
            const cycle = (elapsedRef.current % (duration * 2)) / duration;
            const t = cycle <= 1 ? cycle : 2 - cycle;

            // Vertical position: 1 → 5
            const y = 1 + t * 4;
            // Yaw rotation: 0 → 360°
            const yaw = t * 360;

            if (inPoseLocalSpace) {
                xrLivelink.camera_rig.setPoseLocalOffset({
                    position: [0, y, 0],
                    eulerOrientation: [0, yaw, 0],
                });
            } else {
                xrLivelink.camera_rig.setWorldSpaceOffset({
                    position: [0, y, 0],
                    eulerOrientation: [0, yaw, 0],
                });
            }

            // animationFrameRef.current = xr_session.requestAnimationFrame(animate);
            // };
        }, 1000 / 30);

        // animationFrameRef.current = xr_session.requestAnimationFrame(animate);
    }, [xrLivelink, duration]);

    useEffect(() => {
        return stop;
    }, [stop]);

    const update = useCallback(
        (value: number) => {
            valueRef.current = value;
            if (Math.abs(value) >= 0.01 && !runningRef.current) {
                start();
            } else if (Math.abs(value) < 0.01 && runningRef.current) {
                stop();
            }
        },
        [start, stop],
    );

    return { update };
}

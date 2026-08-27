//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";

//------------------------------------------------------------------------------
import { WebXRContext } from "./WebXRContext";
import type { LXRCameraRig } from "../LXRCameraRig";
import {
    LXRAxisSmoother,
    LXRSnapTurn,
    defaultTurnModeForSessionMode,
    type LXRAxisSmoothingOptions,
    type LXRTurnMode,
} from "../LXRComfort";
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
} from "../LXRLocomotion";
// Animation logic moved to WebXRLocomotion.ts

//------------------------------------------------------------------------------
/**
 * Conditioned axis value under which no movement is applied. Small enough to be invisible; its only
 * job is to stop the rig transform being marked dirty on every frame of a ramp that has all but
 * finished.
 */
const MIN_LOCOMOTION_VALUE = 0.001;

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

            if (!xrLivelink || Math.abs(value) < MIN_LOCOMOTION_VALUE) {
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
 * Hook for left/right strafe movement
 */
export function useXRStrafeMove({ speed, inPoseLocalSpace = true, smoothing }: XRLocomotionOptions = {}): {
    update: (value: number) => void;
} {
    // Import XRStrafeMove from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRStrafeMoveLocalSpace : LXRStrafeMoveWorldSpace, speed, {
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for forward/backward thrust movement
 */
export function useXRThrustMove({ speed, inPoseLocalSpace = true, smoothing }: XRLocomotionOptions = {}): {
    update: (value: number) => void;
} {
    // Import XRThrustMove from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRThrustMoveLocalSpace : LXRThrustMoveWorldSpace, speed, {
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for world vertical movement (up/down on world Y axis)
 */
export function useXRVerticalMove({ speed, inPoseLocalSpace = false, smoothing }: XRLocomotionOptions = {}): {
    update: (value: number) => void;
} {
    // Import XRVerticalMove from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRVerticalMoveLocalSpace : LXRVerticalMoveWorldSpace, speed, {
        smoothing,
    });
}

//------------------------------------------------------------------------------
/**
 * Hook for discrete yaw rotation — one fixed step per stick push, the comfortable alternative to
 * continuous turning. See {@link LXRSnapTurn}.
 *
 * Runs no frame loop of its own: a snap is an event, so it fires straight out of {@link update} on
 * the call that crosses the threshold. The axis has to fall back to rest before another one fires,
 * which means {@link update} must keep being called — a joystick's `onEnd` handler passing 0 is
 * what re-arms it.
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
    const { xrLivelink } = useContext(WebXRContext);

    //--------------------------------------------------------------------------
    const snapTurnRef = useRef<LXRSnapTurn | null>(null);
    snapTurnRef.current ??= new LXRSnapTurn();

    useEffect(() => {
        snapTurnRef.current?.configure({ angle, threshold, release_threshold: releaseThreshold });
    }, [angle, threshold, releaseThreshold]);

    //--------------------------------------------------------------------------
    // A stick left over the threshold when the session ends must not snap again on the next one
    // without being released first.
    useEffect(() => {
        const snap_turn = snapTurnRef.current;
        return (): void => snap_turn?.reset();
    }, [xrLivelink]);

    //--------------------------------------------------------------------------
    const update = useCallback(
        (value: number) => {
            if (!xrLivelink) {
                return;
            }

            const turn_angle = snapTurnRef.current!.update(value);
            if (turn_angle === 0) {
                return;
            }

            const snap = inPoseLocalSpace ? LXRYawSnapLocalSpace : LXRYawSnapWorldSpace;
            snap({ camera_rig: xrLivelink.camera_rig, angle: turn_angle });
        },
        [xrLivelink, inPoseLocalSpace],
    );

    //--------------------------------------------------------------------------
    return useMemo(() => ({ update }), [update]);
}

//------------------------------------------------------------------------------
/**
 * Hook for yaw rotation (left/right on world Y axis), continuous or snapped.
 *
 * @param speed - Speed multiplier, continuous turning only
 * @param inPoseLocalSpace - Whether the rotation is applied in pose-local space rather than world space
 * @param turnMode - `snap` or `smooth`. Left undefined it follows the session mode — see
 * {@link defaultTurnModeForSessionMode} — which snaps in a headset and turns smoothly on a handheld
 * screen.
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
    const { xrLivelink } = useContext(WebXRContext);
    const resolvedTurnMode = turnMode ?? (xrLivelink ? defaultTurnModeForSessionMode(xrLivelink.xr_mode) : "smooth");
    const isSnapping = resolvedTurnMode === "snap";

    //--------------------------------------------------------------------------
    // Both are always mounted — hooks cannot be called conditionally — but only the active one
    // holds a frame loop, and only the active one is fed.
    const smoothTurn = useXRLivelinkAnimation(
        inPoseLocalSpace ? LXRYawRotationLocalSpace : LXRYawRotationWorldSpace,
        speed,
        { smoothing, enabled: !isSnapping },
    );
    const snapTurn = useXRSnapTurn({ angle: snapAngle, inPoseLocalSpace });

    //--------------------------------------------------------------------------
    const update = useCallback(
        (value: number) => {
            if (isSnapping) {
                snapTurn.update(value);
            } else {
                smoothTurn.update(value);
            }
        },
        [isSnapping, snapTurn, smoothTurn],
    );

    //--------------------------------------------------------------------------
    return useMemo(() => ({ update }), [update]);
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

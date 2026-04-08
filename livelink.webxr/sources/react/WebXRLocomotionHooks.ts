//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useRef } from "react";

//------------------------------------------------------------------------------
import { WebXRContext } from "./WebXRContext";
import type { LXRCameraRig } from "../LXRCameraRig";
import {
    LXRStrafeMoveLocalSpace,
    LXRStrafeMoveWorldSpace,
    LXRThrustMoveLocalSpace,
    LXRThrustMoveWorldSpace,
    LXRVerticalMoveLocalSpace,
    LXRVerticalMoveWorldSpace,
    LXRYawRotationLocalSpace,
    LXRYawRotationWorldSpace,
} from "../LXRLocomotion";
// Animation logic moved to WebXRLocomotion.ts

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
 * Generic hook for XR animations driven by a continuous value.
 * Uses the XR session's requestAnimationFrame to stay in sync with the XR display refresh rate.
 *
 * @param callback - The animation callback to execute on each frame
 * @param speed - Speed multiplier for the animation (optional)
 * @returns Object with update function to set the animation value
 */
export function useXRLivelinkAnimation(
    callback: XRAnimationCallback,
    speed?: number,
): {
    update: (value: number) => void;
} {
    //--------------------------------------------------------------------------
    const { xrLivelink } = useContext(WebXRContext);
    const valueRef = useRef(0);
    const animationFrameRef = useRef<number>(0);
    const lastTimeRef = useRef<DOMHighResTimeStamp>(0);

    //--------------------------------------------------------------------------
    useEffect(() => {
        const xr_session = xrLivelink?.xr_session;
        if (!xr_session) {
            return;
        }

        lastTimeRef.current = 0;

        //----------------------------------------------------------------------
        const updateAnimation = (time: DOMHighResTimeStamp, _frame: XRFrame): void => {
            const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
            lastTimeRef.current = time;

            if (Math.abs(valueRef.current) < 0.01) {
                animationFrameRef.current = xr_session.requestAnimationFrame(updateAnimation);
                return;
            }

            callback({
                camera_rig: xrLivelink.camera_rig,
                value: valueRef.current,
                speed,
                dt,
            });

            animationFrameRef.current = xr_session.requestAnimationFrame(updateAnimation);
        };

        animationFrameRef.current = xr_session.requestAnimationFrame(updateAnimation);

        return (): void => {
            if (animationFrameRef.current) {
                xr_session.cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [xrLivelink, speed, callback]);

    //--------------------------------------------------------------------------
    const update = useCallback((value: number) => {
        valueRef.current = value;
    }, []);

    //--------------------------------------------------------------------------
    return { update };
}

//------------------------------------------------------------------------------
/**
 * Hook for left/right strafe movement
 */
export function useXRStrafeMove({
    speed,
    inPoseLocalSpace = true,
}: { speed?: number; inPoseLocalSpace?: boolean } = {}): {
    update: (value: number) => void;
} {
    // Import XRStrafeMove from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRStrafeMoveLocalSpace : LXRStrafeMoveWorldSpace, speed);
}

//------------------------------------------------------------------------------
/**
 * Hook for forward/backward thrust movement
 */
export function useXRThrustMove({
    speed,
    inPoseLocalSpace = true,
}: { speed?: number; inPoseLocalSpace?: boolean } = {}): {
    update: (value: number) => void;
} {
    // Import XRThrustMove from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRThrustMoveLocalSpace : LXRThrustMoveWorldSpace, speed);
}

//------------------------------------------------------------------------------
/**
 * Hook for world vertical movement (up/down on world Y axis)
 */
export function useXRVerticalMove({
    speed,
    inPoseLocalSpace = false,
}: { speed?: number; inPoseLocalSpace?: boolean } = {}): {
    update: (value: number) => void;
} {
    // Import XRVerticalMove from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRVerticalMoveLocalSpace : LXRVerticalMoveWorldSpace, speed);
}

//------------------------------------------------------------------------------
/**
 * Hook for world yaw rotation (left/right on world Y axis)
 */
export function useXRYawRotation({
    speed,
    inPoseLocalSpace = false,
}: { speed?: number; inPoseLocalSpace?: boolean } = {}): {
    update: (value: number) => void;
} {
    // Import XRYawRotation from WebXRLocomotion.ts if needed
    return useXRLivelinkAnimation(inPoseLocalSpace ? LXRYawRotationLocalSpace : LXRYawRotationWorldSpace, speed);
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

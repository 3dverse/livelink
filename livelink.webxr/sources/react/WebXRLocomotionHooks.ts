//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useRef } from "react";
import { Quaternion, Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
import { WebXRContext } from "./WebXRContext";
import type { XRLivelink } from "../XRLivelink";

//------------------------------------------------------------------------------
/**
 * Callback function type for XR animations
 * @param xrLivelink - The XRLivelink instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param deltaTime - Time elapsed since last frame in seconds
 */
export type XRAnimationCallback = (xrLivelink: XRLivelink, value: number, speed: number, deltaTime: number) => void;

//------------------------------------------------------------------------------
/**
 * Generic hook for XR animations driven by a continuous value.
 * Uses the XR session's requestAnimationFrame to stay in sync with the XR display refresh rate.
 *
 * @param callback - The animation callback to execute on each frame
 * @param speed - Speed multiplier for the animation (default: 0.05)
 * @returns Object with update function to set the animation value
 */
export function useXRLivelinkAnimation(
    callback: XRAnimationCallback,
    speed: number = 0.05,
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
        if (!xrLivelink?.camera_rig || !xr_session) {
            return;
        }

        lastTimeRef.current = 0;

        //----------------------------------------------------------------------
        const updateAnimation = (time: DOMHighResTimeStamp, _frame: XRFrame): void => {
            const deltaTime = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
            lastTimeRef.current = time;

            if (Math.abs(valueRef.current) < 0.01) {
                animationFrameRef.current = xr_session.requestAnimationFrame(updateAnimation);
                return;
            }

            callback(xrLivelink, valueRef.current, speed, deltaTime);

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
export function useXRStrafeMove(speed: number = 4): {
    update: (value: number) => void;
} {
    return useXRLivelinkAnimation((xrLivelink, value, speed, deltaTime) => {
        const cameraRig = xrLivelink.camera_rig;
        const poseEntity = cameraRig.pose_entity;
        if (!poseEntity) {
            return;
        }

        const orientation = poseEntity.local_transform.orientation || [0, 0, 0, 1];
        const orientationQuat = new Quaternion(...orientation);

        const strafe = new Vector3(value * speed * deltaTime, 0, 0);
        strafe.applyQuaternion(orientationQuat);

        cameraRig.incrementPoseLocalOffset({
            position: [strafe.x, strafe.y, strafe.z],
        });
    }, speed);
}

//------------------------------------------------------------------------------
/**
 * Hook for forward/backward thrust movement
 */
export function useXRThrustMove(speed: number = 4): {
    update: (value: number) => void;
} {
    return useXRLivelinkAnimation((xrLivelink, value, speed, deltaTime) => {
        const cameraRig = xrLivelink.camera_rig;
        const poseEntity = cameraRig.pose_entity;
        if (!poseEntity) {
            return;
        }

        const orientation = poseEntity.local_transform.orientation || [0, 0, 0, 1];
        const orientationQuat = new Quaternion(...orientation);

        const forward = new Vector3(0, 0, value * speed * deltaTime);
        forward.applyQuaternion(orientationQuat);

        cameraRig.incrementPoseLocalOffset({
            position: [forward.x, forward.y, forward.z],
        });
    }, speed);
}

//------------------------------------------------------------------------------
/**
 * Hook for world vertical movement (up/down on world Y axis).
 * Uses world-space transform so vertical movement is always along
 * the world Y axis regardless of head orientation.
 */
export function useXRVerticalMove(speed: number = 4): {
    update: (value: number) => void;
} {
    return useXRLivelinkAnimation((xrLivelink, value, speed, deltaTime) => {
        xrLivelink.camera_rig.incrementWorldSpaceOffset({ position: [0, value * speed * deltaTime, 0] });
    }, speed);
}

//------------------------------------------------------------------------------
/**
 * Hook for world yaw rotation (left/right on world Y axis).
 * Uses world-space transform so the rotation is always around the
 * world Y axis and forward movement follows the rotated direction.
 */
export function useXRYawRotation(speed: number = 144): {
    update: (value: number) => void;
} {
    return useXRLivelinkAnimation((xrLivelink, value, speed, deltaTime) => {
        xrLivelink.camera_rig.incrementWorldSpaceOffset({ eulerOrientation: [0, value * speed * deltaTime, 0] });
    }, speed);
}

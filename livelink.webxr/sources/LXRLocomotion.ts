//------------------------------------------------------------------------------
import { Quaternion, Vector3 } from "threejs-math";
import { type Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import type { LXRCameraRig } from "./LXRCameraRig";

/**
 * Helper functions to copute the strafe movement vector
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param dt - Time elapsed since last frame in seconds
 * @returns The calculated strafe vector or null if pose_entity is not available
 */
function getStrafeVector({
    camera_rig,
    value,
    speed,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed: number;
    dt: number;
}): Vec3 | null {
    const { pose_entity } = camera_rig;
    if (!pose_entity) {
        return null;
    }
    const orientation = new Quaternion().fromArray(pose_entity.local_transform.orientation || [0, 0, 0, 1]);
    const strafe = new Vector3(value * speed * dt * camera_rig.scale, 0, 0);
    strafe.applyQuaternion(orientation);
    return [strafe.x, strafe.y, strafe.z];
}

/**
 * Animation function for left/right strafe movement (local space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 2)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRStrafeMoveLocalSpace({
    camera_rig,
    value,
    speed = 2,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    const position = getStrafeVector({ camera_rig, value, speed, dt });
    if (position) {
        camera_rig.incrementPoseLocalOffset({ position });
    }
}

/**
 * Animation function for left/right strafe movement (world space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 2)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRStrafeMoveWorldSpace({
    camera_rig,
    value,
    speed = 2,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    const position = getStrafeVector({ camera_rig, value, speed, dt });
    if (position) {
        camera_rig.incrementWorldSpaceOffset({ position });
    }
}

/**
 * Helper function to compute the thrust movement vector
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param dt - Time elapsed since last frame in seconds
 * @returns The calculated thrust vector or null if pose_entity is not available
 */
function getThrustVector({
    camera_rig,
    value,
    speed,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed: number;
    dt: number;
}): Vec3 | null {
    const { pose_entity } = camera_rig;
    if (!pose_entity) {
        return null;
    }
    const orientation = new Quaternion().fromArray(pose_entity.local_transform.orientation || [0, 0, 0, 1]);
    const forward = new Vector3(0, 0, value * speed * dt * camera_rig.scale);
    forward.applyQuaternion(orientation);
    return [forward.x, forward.y, forward.z];
}

/**
 * Animation function for forward/backward thrust movement (local space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 4)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRThrustMoveLocalSpace({
    camera_rig,
    value,
    speed = 4,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    const position = getThrustVector({ camera_rig, value, speed, dt });
    if (position) {
        camera_rig.incrementPoseLocalOffset({ position });
    }
}

/**
 * Animation function for forward/backward thrust movement (world space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 4)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRThrustMoveWorldSpace({
    camera_rig,
    value,
    speed = 4,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    const position = getThrustVector({ camera_rig, value, speed, dt });
    if (position) {
        camera_rig.incrementWorldSpaceOffset({ position });
    }
}

/**
 * Animation function for vertical movement (up/down on world Y axis, local space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 2)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRVerticalMoveLocalSpace({
    camera_rig,
    value,
    speed = 2,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    camera_rig.incrementPoseLocalOffset({
        position: [0, value * speed * dt * camera_rig.scale, 0],
    });
}

/**
 * Animation function for vertical movement (up/down on world Y axis, world space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 2)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRVerticalMoveWorldSpace({
    camera_rig,
    value,
    speed = 2,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    camera_rig.incrementWorldSpaceOffset({
        position: [0, value * speed * dt * camera_rig.scale, 0],
    });
}

/**
 * Animation function for yaw rotation (left/right on world Y axis, local space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 40)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRYawRotationLocalSpace({
    camera_rig,
    value,
    speed = 40,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    camera_rig.incrementPoseLocalOffset({ eulerOrientation: [0, value * speed * dt, 0] });
}

/**
 * Animation function for yaw rotation (left/right on world Y axis, world space)
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier (default: 40)
 * @param dt - Time elapsed since last frame in seconds
 */
export function LXRYawRotationWorldSpace({
    camera_rig,
    value,
    speed = 40,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed?: number;
    dt: number;
}): void {
    camera_rig.incrementWorldSpaceOffset({ eulerOrientation: [0, value * speed * dt, 0] });
}

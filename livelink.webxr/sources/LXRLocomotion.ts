//------------------------------------------------------------------------------
import { Quaternion, Vector3 } from "threejs-math";
import { type Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import type { LXRCameraRig } from "./LXRCameraRig";

//------------------------------------------------------------------------------
/**
 * Scratch maths objects for the movement vectors.
 *
 * Every function here runs once per axis per frame inside a 72–90 Hz loop, so the `new Quaternion()`
 * / `new Vector3()` they used to allocate added up to a steady stream of short-lived objects — and a
 * garbage collection during a locomotion frame is felt as a hitch, on the very frames the user is
 * moving. Reuse is safe because none of these functions yields or calls another one of them while a
 * scratch value is live.
 */
const scratch = {
    orientation: new Quaternion(),
    direction: new Vector3(),
};

/**
 * Reused delta payloads handed to the camera rig. The rig copies out of them synchronously, so one
 * of each for the whole module is enough and neither the object nor its array is reallocated.
 */
const position_delta: { position: Vec3 } = { position: [0, 0, 0] };
const euler_delta: { eulerOrientation: Vec3 } = { eulerOrientation: [0, 0, 0] };

/**
 * Read the pose orientation of the rig into the scratch quaternion.
 *
 * @param camera_rig - The LXRCameraRig instance
 * @returns True if the rig has a pose entity to read from
 */
function readPoseOrientation(camera_rig: LXRCameraRig): boolean {
    const { pose_entity } = camera_rig;
    if (!pose_entity) {
        return false;
    }

    const { orientation } = pose_entity.local_transform;
    if (orientation) {
        scratch.orientation.set(orientation[0], orientation[1], orientation[2], orientation[3]);
    } else {
        scratch.orientation.set(0, 0, 0, 1);
    }
    return true;
}

/**
 * Helper function to compute the strafe movement vector into {@link position_delta}
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param dt - Time elapsed since last frame in seconds
 * @returns True if the delta was computed, false if pose_entity is not available
 */
function computeStrafeDelta({
    camera_rig,
    value,
    speed,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed: number;
    dt: number;
}): boolean {
    if (!readPoseOrientation(camera_rig)) {
        return false;
    }

    const strafe = scratch.direction.set(value * speed * dt * camera_rig.scale, 0, 0);
    strafe.applyQuaternion(scratch.orientation).toArray(position_delta.position);
    return true;
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
    if (computeStrafeDelta({ camera_rig, value, speed, dt })) {
        camera_rig.incrementPoseLocalOffset(position_delta);
        camera_rig.reportLocomotionIntensity(value);
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
    if (computeStrafeDelta({ camera_rig, value, speed, dt })) {
        camera_rig.incrementWorldSpaceOffset(position_delta);
        camera_rig.reportLocomotionIntensity(value);
    }
}

/**
 * Helper function to compute the thrust movement vector into {@link position_delta}
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param dt - Time elapsed since last frame in seconds
 * @returns True if the delta was computed, false if pose_entity is not available
 */
function computeThrustDelta({
    camera_rig,
    value,
    speed,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed: number;
    dt: number;
}): boolean {
    if (!readPoseOrientation(camera_rig)) {
        return false;
    }

    const forward = scratch.direction.set(0, 0, value * speed * dt * camera_rig.scale);
    forward.applyQuaternion(scratch.orientation).toArray(position_delta.position);
    return true;
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
    if (computeThrustDelta({ camera_rig, value, speed, dt })) {
        camera_rig.incrementPoseLocalOffset(position_delta);
        camera_rig.reportLocomotionIntensity(value);
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
    if (computeThrustDelta({ camera_rig, value, speed, dt })) {
        camera_rig.incrementWorldSpaceOffset(position_delta);
        camera_rig.reportLocomotionIntensity(value);
    }
}

/**
 * Write a vertical movement delta into {@link position_delta}.
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param value - The current animation value
 * @param speed - The speed multiplier
 * @param dt - Time elapsed since last frame in seconds
 */
function computeVerticalDelta({
    camera_rig,
    value,
    speed,
    dt,
}: {
    camera_rig: LXRCameraRig;
    value: number;
    speed: number;
    dt: number;
}): void {
    position_delta.position[0] = 0;
    position_delta.position[1] = value * speed * dt * camera_rig.scale;
    position_delta.position[2] = 0;
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
    computeVerticalDelta({ camera_rig, value, speed, dt });
    camera_rig.incrementPoseLocalOffset(position_delta);
    camera_rig.reportLocomotionIntensity(value);
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
    computeVerticalDelta({ camera_rig, value, speed, dt });
    camera_rig.incrementWorldSpaceOffset(position_delta);
    camera_rig.reportLocomotionIntensity(value);
}

/**
 * Write a yaw delta of `degrees` into {@link euler_delta}.
 *
 * @param degrees - Rotation around the Y axis, in degrees
 */
function setYawDelta(degrees: number): void {
    euler_delta.eulerOrientation[0] = 0;
    euler_delta.eulerOrientation[1] = degrees;
    euler_delta.eulerOrientation[2] = 0;
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
    setYawDelta(value * speed * dt);
    camera_rig.incrementPoseLocalOffset(euler_delta);
    camera_rig.reportLocomotionIntensity(value);
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
    setYawDelta(value * speed * dt);
    camera_rig.incrementWorldSpaceOffset(euler_delta);
    camera_rig.reportLocomotionIntensity(value);
}

/**
 * Apply one discrete yaw step (pose-local space). See {@link LXRSnapTurn} for why a step rather
 * than a rotation.
 *
 * Unlike the continuous functions this takes an angle rather than an axis value and a duration:
 * a snap is an event, not a rate, and its size must not depend on the frame it lands on. It does
 * not report locomotion intensity either — the vignette exists to suppress the vection of a
 * continuous motion, and there is none to suppress here.
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param angle - The signed angle to turn, in degrees
 */
export function LXRYawSnapLocalSpace({ camera_rig, angle }: { camera_rig: LXRCameraRig; angle: number }): void {
    if (angle === 0) {
        return;
    }

    setYawDelta(angle);
    camera_rig.incrementPoseLocalOffset(euler_delta);
}

/**
 * Apply one discrete yaw step (world space). See {@link LXRYawSnapLocalSpace}.
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param angle - The signed angle to turn, in degrees
 */
export function LXRYawSnapWorldSpace({ camera_rig, angle }: { camera_rig: LXRCameraRig; angle: number }): void {
    if (angle === 0) {
        return;
    }

    setYawDelta(angle);
    camera_rig.incrementWorldSpaceOffset(euler_delta);
}

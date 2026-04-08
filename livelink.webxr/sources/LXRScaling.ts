//------------------------------------------------------------------------------
import { Vector3 } from "threejs-math";
import { type Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import type { LXRCameraRig } from "./LXRCameraRig";

//------------------------------------------------------------------------------
/**
 * Compute the next coarse-logarithmic scale step up from the current value.
 *
 * | Current range  | Step  |
 * |----------------|-------|
 * | [100, 1000]    | 100   |
 * | [10,  100)     | 10    |
 * | [1,   10)      | 0.5   |
 * | [0.1, 1)       | 0.05  |
 * | [0.01, 0.1)    | 0.01  |
 * | [0.001, 0.01)  | 0.001 |
 */
function nextScaleUp(scale: number): number {
    if (scale >= 100) return Math.min(scale + 100, 1000);
    if (scale >= 10) return scale + 10;
    if (scale >= 1) return scale + 0.5;
    if (scale >= 0.1) return scale + 0.05;
    if (scale >= 0.01) return scale + 0.01;
    return scale + 0.001;
}

/**
 * Compute the next coarse-logarithmic scale step down from the current value.
 * Uses strict `>` at range boundaries so scale=10 steps down by 0.5, not 10.
 *
 * | Current range  | Step  |
 * |----------------|-------|
 * | [100, 1000]    | 100   |
 * | [10,  100)     | 10    |
 * | [1,   10)      | 0.5   |
 * | [0.1, 1)       | 0.05  |
 * | [0.01, 0.1)    | 0.01  |
 * | [0.001, 0.01)  | 0.001 |
 */
function nextScaleDown(scale: number): number {
    if (scale > 100) return scale - 100;
    if (scale > 10) return scale - 10;
    if (scale > 1) return scale - 0.5;
    if (scale > 0.1) return scale - 0.05;
    if (scale > 0.01) return scale - 0.01;
    return Math.max(scale - 0.001, 0.001);
}

/**
 * Apply a new scale to the rig, optionally compensating the anchor position.
 *
 * **VR mode** (`compensate_anchor_position = true`): shifts the anchor so the user's center eye
 * stays at the same apparent world position — the virtual world scales around the user.
 *
 * **AR mode** (`compensate_anchor_position = false`): the anchor position is left unchanged.
 * The virtual world grows or shrinks in place around the anchor point, preserving its
 * real-world registration (e.g. a hit-test placement stays fixed on the surface it was placed on).
 *
 * `global_transform` is read before applying the new scale since it depends on the current scale.
 */
function applyScale(camera_rig: LXRCameraRig, newScale: number, compensate_anchor_position: boolean): number {
    const { pose_entity, anchor_entity } = camera_rig;

    if (compensate_anchor_position && pose_entity && anchor_entity) {
        // VR: move the anchor so the center eye apparent position stays fixed (world scales around user).
        const ratio = newScale / camera_rig.scale;
        const { position: center_eye } = pose_entity.global_transform;
        const delta = new Vector3(...center_eye).multiplyScalar(ratio - 1);
        anchor_entity.local_transform.position = delta
            .add(new Vector3(...(anchor_entity.local_transform.position || [0, 0, 0])))
            .toArray() as Vec3;
    }

    // AR: anchor position is left unchanged — the virtual world grows/shrinks around the anchor point.

    camera_rig.scale = newScale;
    return newScale;
}

/**
 * Scale up the camera rig by one coarse-logarithmic step.
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param compensate_anchor_position - When `true` (default), shifts the anchor so the user's center
 *   eye stays at the same apparent world position (VR: world scales around the user). When `false`,
 *   the anchor is left unchanged and the virtual world grows/shrinks around the anchor point (AR:
 *   hit-test placement stays registered to the same real-world surface).
 * @returns The new scale factor.
 */
export function LXRScaleUp(
    camera_rig: LXRCameraRig,
    { compensate_anchor_position = true }: { compensate_anchor_position?: boolean } = {},
): number {
    if (!camera_rig.anchor_entity) {
        throw new Error("No camera rig anchor entity initialized");
    }
    if (compensate_anchor_position && !camera_rig.pose_entity) {
        throw new Error("No camera rig pose entity initialized");
    }
    return applyScale(camera_rig, nextScaleUp(camera_rig.scale), compensate_anchor_position);
}

/**
 * Scale down the camera rig by one coarse-logarithmic step.
 *
 * @param camera_rig - The LXRCameraRig instance
 * @param compensate_anchor_position - When `true` (default), shifts the anchor so the user's center
 *   eye stays at the same apparent world position (VR: world scales around the user). When `false`,
 *   the anchor is left unchanged and the virtual world grows/shrinks around the anchor point (AR:
 *   hit-test placement stays registered to the same real-world surface).
 * @returns The new scale factor.
 */
export function LXRScaleDown(
    camera_rig: LXRCameraRig,
    { compensate_anchor_position = true }: { compensate_anchor_position?: boolean } = {},
): number {
    if (!camera_rig.anchor_entity) {
        throw new Error("No camera rig anchor entity initialized");
    }
    if (compensate_anchor_position && !camera_rig.pose_entity) {
        throw new Error("No camera rig pose entity initialized");
    }
    return applyScale(camera_rig, nextScaleDown(camera_rig.scale), compensate_anchor_position);
}

import type { Mat4, Quat, Vec3 } from "@3dverse/livelink.core";
import { Camera } from "../Camera";

/**
 * @category Streaming
 */

export type FrameCameraTransform = {
    /**
     * Camera Entity
     */
    camera: Camera;

    /**
     * Transform view space to world space matrix
     */
    world_from_view_matrix: Mat4;

    /**
     * World space position of the camera in the frame
     */
    world_position: Vec3;

    /**
     * World space orientation of the camera in the frame
     */
    world_orientation: Quat;
};

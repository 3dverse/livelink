import type { Quat, Vec3 } from "@3dverse/livelink.core";
import { Camera } from "../Camera";

/**
 * @category Streaming
 */

export type CameraFrameTransform = {
    /**
     * Camera Entity
     */
    camera: Camera;

    /**
     * World space transform of the camera in the frame
     */
    position: Vec3;

    /**
     * World space orientation of the camera in the frame
     */
    orientation: Quat;
};

import { CameraFrameTransform } from "./CameraFrameTransform";

/**
 *
 */

export type CurrentFrameMetaData = {
    /**
     * Timestamp of the frame
     */
    renderer_timestamp: number;

    /**
     * Number of the frame, incremented for each frame
     */
    frame_counter: number;

    /**
     * Camera transforms of each viewport in the frame
     */
    cameras: Array<CameraFrameTransform>;
};

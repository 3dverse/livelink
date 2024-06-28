import { CameraFrameTransform } from "./CameraFrameTransform";

/**
 *
 */

export type RawFrameMetaData = {
    /**
     * Timestamp of the frame
     */
    renderer_timestamp: number;

    /**
     * Number of the frame, incremented for each frame
     */
    frame_counter: number;

    /**
     * Camera transforms of each client viewport in the frame
     */
    current_client_cameras: Array<CameraFrameTransform>;

    /**
     * Camera transforms of each other client viewport in the frame
     */
    other_clients_cameras: Array<CameraFrameTransform>;
};

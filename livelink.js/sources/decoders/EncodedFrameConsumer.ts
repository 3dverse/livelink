import type { CodecType, Quat, Vec2i, Vec3 } from "@3dverse/livelink.core";
import { Camera } from "../Camera";

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

/**
 *
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

/**
 *
 */
export abstract class EncodedFrameConsumer {
    /**
     *
     */
    abstract configure({
        codec,
        frame_dimensions,
    }: {
        codec: CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer>;

    /**
     *
     */
    abstract consumeEncodedFrame(frame: { encoded_frame: DataView; meta_data: RawFrameMetaData }): void;

    /**
     *
     */
    applyFrameMetaData(meta_data: RawFrameMetaData): CurrentFrameMetaData {
        for (const { camera, position, orientation } of meta_data.other_clients_cameras) {
            camera._setLocalTransform({ position, orientation });
        }

        return {
            renderer_timestamp: meta_data.renderer_timestamp,
            frame_counter: meta_data.frame_counter,
            cameras: meta_data.current_client_cameras,
        };
    }

    /**
     *
     */
    abstract release(): void;
}

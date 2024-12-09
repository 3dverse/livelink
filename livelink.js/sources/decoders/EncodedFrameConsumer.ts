import type { CodecType, Vec2i } from "@3dverse/livelink.core";
import { FrameMetaData } from "./FrameMetaData";
import { CurrentFrameMetaData } from "./CurrentFrameMetaData";

/**
 *  @category Streaming
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
    abstract consumeEncodedFrame(frame: { encoded_frame: DataView; meta_data: FrameMetaData }): void;

    /**
     *
     */
    applyFrameMetaData(meta_data: FrameMetaData): CurrentFrameMetaData {
        for (const { camera, world_position, world_orientation } of meta_data.other_clients_cameras) {
            camera._setLocalTransform({ world_position, world_orientation });
        }

        for (const frame_camera_transform of meta_data.current_client_cameras) {
            frame_camera_transform.camera.updateClipFromWorldMatrix({ frame_camera_transform });
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

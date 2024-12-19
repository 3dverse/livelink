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
    applyFrameMetaData({ meta_data }: { meta_data: FrameMetaData }): CurrentFrameMetaData {
        this.#setCamerasGlobalTransform({ meta_data });

        for (const frame_camera_transform of meta_data.current_client_camera_entities) {
            frame_camera_transform.viewport.camera?.updateClipFromWorldMatrix({ frame_camera_transform });
        }

        return {
            renderer_timestamp: meta_data.renderer_timestamp,
            frame_counter: meta_data.frame_counter,
            cameras: meta_data.current_client_camera_entities,
        };
    }

    /**
     *
     */
    #setCamerasGlobalTransform({ meta_data }: { meta_data: FrameMetaData }) {
        for (const { camera_entity, world_position, world_orientation } of meta_data.other_clients_camera_entities) {
            // TODO: This should actually set the global transform not the local transform.
            camera_entity._updateFromEvent({
                updated_components: { local_transform: { position: world_position, orientation: world_orientation } },
            });
        }
    }

    /**
     *
     */
    abstract release(): void;
}

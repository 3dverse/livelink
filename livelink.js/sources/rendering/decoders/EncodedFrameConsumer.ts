import type { CodecType, Vec2i } from "@3dverse/livelink.core";
import { FrameMetaData } from "./FrameMetaData";

/**
 * A base class for consuming encoded frames.
 * This class can be extended to create custom encoded frame consumers.
 * As an example, a custom consumer could be created to embed the encoded frames
 * in a video container format like MP4.
 *
 * Implementations of this class should call the applyFrameMetaData method as
 * soon as the frame is decoded to update the cameras in the scene so that any
 * compositor - like a WebGL canvas - can render the frame correctly.
 *
 * {@link WebCodecsDecoder} and {@link SoftwareDecoder} are examples of classes that extend this class.
 *
 * @category Streaming
 */
export abstract class EncodedFrameConsumer {
    /**
     * Configure the consumer with the codec and frame dimensions.
     *
     * This method replaces the constructor to allow for async initialization.
     *
     * This method should be called before any frames are consumed.
     *
     * The consumer should be ready to consume frames after this method is called.
     *
     * @param params
     * @param params.codec - The codec used to encode the frames
     * @param params.frame_dimensions - The dimensions of the frame
     *
     * @returns Must return a promise to `this` so that the method can be chained
     * after the constructor:
     * ```typescript
     * const consumer = new MyConsumer().configure({ codec, frame_dimensions });
     * ```
     */
    abstract configure({
        codec,
        frame_dimensions,
    }: {
        codec: CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer>;

    /**
     * Release any resources used by the consumer.
     */
    abstract release(): void;

    /**
     * Consume an encoded frame. Called as soon as a frame is received.
     *
     * @param frame
     * @param frame.encoded_frame - The encoded frame data
     * @param frame.meta_data - The frame meta data
     */
    abstract consumeEncodedFrame(frame: { encoded_frame: DataView; meta_data: FrameMetaData }): void;

    /**
     * Apply the frame meta data to the scene.
     * This method should be called as soon as the frame is decoded to update the cameras in the scene.
     *
     * @param params
     * @param params.meta_data - The frame meta data
     *
     * @returns The current frame meta data
     */
    applyFrameMetaData({ meta_data }: { meta_data: FrameMetaData }): void {
        this.#setCamerasGlobalTransform({ meta_data });

        for (const frame_camera_transform of meta_data.current_client_camera_entities) {
            frame_camera_transform.viewport.camera_projection?.updateClipFromWorldMatrix({ frame_camera_transform });
        }
    }

    /**
     * Set the global transform of the cameras in the scene.
     */
    #setCamerasGlobalTransform({ meta_data }: { meta_data: FrameMetaData }) {
        for (const { camera_entity, world_position, world_orientation } of meta_data.other_clients_camera_entities) {
            // TODO: This should actually set the global transform not the local transform.
            camera_entity._mergeComponents({
                components: { local_transform: { position: world_position, orientation: world_orientation } },
            });
        }
    }
}

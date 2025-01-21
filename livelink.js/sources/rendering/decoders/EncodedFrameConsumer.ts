//------------------------------------------------------------------------------
import type { Enums, Vec2i } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { FrameMetaData } from "./FrameMetaData";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";

/**
 * A base class for consuming encoded frames.
 *
 * ```mermaid
 * flowchart LR
 *   A(Renderer) -->|Network Packet| B(Core)
 *   B -->|Encoded Frame| C(EncodedFrameConsumer)
 *   C -->|Decoded Frame| D(DecodedFrameConsumer)
 *   style C fill:#191,stroke:#333,stroke-width:4px
 * ```
 *
 * This class can be extended to create custom encoded frame consumers.
 *
 * As an example, a custom consumer could be created to embed the encoded frames
 * in a video container format like MP4.
 *
 * {@link WebCodecsDecoder} and {@link SoftwareDecoder} are examples of classes that extend this class.
 *
 * @category Streaming
 */
export abstract class EncodedFrameConsumer {
    /**
     * The decoded frame consumer that will consume the decoded frames.
     */
    #decoded_frame_consumer: DecodedFrameConsumer | null = null;

    /**
     * Create a new encoded frame consumer.
     *
     * @param params
     * @param params.decoded_frame_consumer - The decoded frame consumer that will receive the decoded frames
     */
    constructor({ decoded_frame_consumer }: { decoded_frame_consumer: DecodedFrameConsumer | null }) {
        this.#decoded_frame_consumer = decoded_frame_consumer;
    }

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
     * @returns Must return a promise to `this` so that the method can be chained to the constructor:
     * ```typescript
     * const consumer = new MyConsumer().configure({ codec, frame_dimensions });
     * ```
     */
    abstract configure({
        codec,
        frame_dimensions,
    }: {
        codec: Enums.CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer>;

    /**
     * Resize the consumer with the new frame dimensions.
     */
    abstract resize({ frame_dimensions }: { frame_dimensions: Vec2i }): void;

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
     * Must be called by the implementation as soon as the frame is decoded to update the cameras in the scene.
     * @param frame - The decoded frame data
     * @param frame.meta_data - The frame meta data
     * @param frame.decoded_frame - The decoded frame data
     */
    protected _onFrameDecoded(frame: { decoded_frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData }): void {
        this.#applyFrameMetaData(frame);
        this.#decoded_frame_consumer?.consumeDecodedFrame(frame);
    }

    /**
     * Apply the frame meta data to the cameras in the scene.
     */
    #applyFrameMetaData({ meta_data }: { meta_data: FrameMetaData }): void {
        this.#setNotControlledCamerasGlobalTransform({ meta_data });

        for (const frame_camera_transform of meta_data.viewport_layout_camera_entities) {
            frame_camera_transform.viewport.camera_projection?.updateFromFrameCameraTransform({
                frame_camera_transform,
            });
        }
    }

    /**
     * Set the global transform of the cameras that are not controlled by the current client.
     */
    #setNotControlledCamerasGlobalTransform({ meta_data }: { meta_data: FrameMetaData }): void {
        for (const { camera_entity, world_position, world_orientation } of meta_data.other_clients_camera_entities) {
            // TODO: This should actually set the global transform not the local transform.
            camera_entity._mergeComponents({
                components: { local_transform: { position: world_position, orientation: world_orientation } },
                dispatch_event: true,
            });
        }
    }
}

//------------------------------------------------------------------------------
import type { Enums, Vec2i } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import type { FrameMetaData } from "./FrameMetaData";
import type { DecodedFrameConsumer } from "./DecodedFrameConsumer";

/**
 * @category Streaming
 */
export type EncodedFrame = {
    /**
     * The encoded frame data.
     */
    video_stream: DataView;

    /**
     * Meta data about the frame.
     */
    meta_data: FrameMetaData;
};

/**
 * @category Streaming
 */
export type DecodedFrame = {
    /**
     * The decoded frame data.
     */
    pixels: VideoFrame | OffscreenCanvas;

    /**
     * Frame dimensions in pixels.
     */
    dimensions_in_pixels: Vec2i;

    /**
     * Meta data about the frame.
     */
    meta_data: FrameMetaData;
};

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
     *
     * @param params
     * @param params.frame_dimensions - The new frame dimensions
     */
    abstract resize({ frame_dimensions }: { frame_dimensions: Vec2i }): void;

    /**
     * Release any resources used by the consumer.
     */
    abstract release(): void;

    /**
     * Consume an encoded frame. Called as soon as a frame is received.
     *
     * @param params
     * @param params.encoded_frame - The encoded frame data
     */
    abstract consumeEncodedFrame({ encoded_frame }: { encoded_frame: EncodedFrame }): void;

    /**
     * Must be called by the implementation as soon as the frame is decoded to update the cameras in the scene.
     *
     * @param frame - The decoded frame data
     * @param frame.meta_data - The frame meta data
     * @param frame.decoded_frame - The decoded frame data
     */
    protected _onFrameDecoded({ decoded_frame }: { decoded_frame: DecodedFrame }): void {
        this.#applyFrameMetaData({ meta_data: decoded_frame.meta_data });
        this.#decoded_frame_consumer?.consumeDecodedFrame({ decoded_frame });
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
            camera_entity._setGlobalTransform({
                global_transform: { position: world_position, orientation: world_orientation },
                change_source: "external",
            });
        }
    }
}

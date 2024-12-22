import { FrameMetaData } from "./FrameMetaData";

/**
 * The interface for consuming decoded frames.
 *
 * ```mermaid
 * flowchart LR
 *   A(Renderer) -->|Network Packet| B(Core)
 *   B -->|Encoded Frame| C(EncodedFrameConsumer)
 *   C -->|Decoded Frame| D(DecodedFrameConsumer)
 *   style D fill:#191,stroke:#333,stroke-width:4px
 * ```
 *
 * To consume decoded frames, implement this interface and pass an instance of your class to the
 * `encoded_frame_consumer` when calling {@link Livelink.setEncodedFrameConsumer}.
 *
 * The {@link EncodedFrameConsumer} will call the `consumeDecodedFrame` method as soon as a frame is decoded.
 *
 * The Livelink SDK has an internal default implementation of this interface.
 * It can be retrieved via the {@link Livelink.default_decoded_frame_consumer} property.
 *
 * It is recommended to use the default implementation.
 *
 *  @category Streaming
 */
export interface DecodedFrameConsumer {
    /**
     * Consume a decoded frame.
     *
     * This method is called as soon as a frame is decoded.
     *
     * @param params
     * @param params.decoded_frame - The decoded frame data
     * @param params.meta_data - The frame meta data
     */
    consumeDecodedFrame({
        decoded_frame,
        meta_data,
    }: {
        decoded_frame: VideoFrame | OffscreenCanvas;
        meta_data: FrameMetaData;
    }): void;
}

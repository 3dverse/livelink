import { FrameMetaData } from "./FrameMetaData";

/**
 *  @category Streaming
 */
export interface DecodedFrameConsumer {
    /**
     *
     */
    consumeDecodedFrame({
        decoded_frame,
        meta_data,
    }: {
        decoded_frame: VideoFrame | OffscreenCanvas;
        meta_data: FrameMetaData;
    }): void;
}

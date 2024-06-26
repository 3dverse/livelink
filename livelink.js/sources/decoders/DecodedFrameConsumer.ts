import { CurrentFrameMetaData } from "./EncodedFrameConsumer";

/**
 *
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
        meta_data: CurrentFrameMetaData;
    }): void;
}

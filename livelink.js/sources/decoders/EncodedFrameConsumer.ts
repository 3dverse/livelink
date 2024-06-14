import type { CodecType, Vec2i } from "livelink.core";

/**
 *
 */
export interface EncodedFrameConsumer {
    /**
     *
     */
    configure({
        codec,
        frame_dimensions,
    }: {
        codec: CodecType;
        frame_dimensions: Vec2i;
    }): Promise<EncodedFrameConsumer>;

    /**
     *
     */
    consumeEncodedFrame({ encoded_frame }: { encoded_frame: DataView }): void;

    /**
     *
     */
    release(): void;
}

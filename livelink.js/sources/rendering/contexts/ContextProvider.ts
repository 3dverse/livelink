import { FrameMetaData } from "../decoders/FrameMetaData";

/**
 * @category Rendering
 */
export abstract class ContextProvider {
    /**
     *
     */
    abstract drawFrame({
        frame,
        left,
        top,
        meta_data,
    }: {
        frame: VideoFrame | OffscreenCanvas;
        left: number;
        top: number;
        meta_data: FrameMetaData;
    }): void;

    /**
     *
     */
    refreshSize(): void {}

    /**
     *
     */
    abstract release(): void;
}

import { CurrentFrameMetaData } from "../decoders/CurrentFrameMetaData";

/**
 *
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
        meta_data: CurrentFrameMetaData;
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

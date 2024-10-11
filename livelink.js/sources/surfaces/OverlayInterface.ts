import type { CurrentFrameMetaData } from "../decoders/CurrentFrameMetaData";
import type { Viewport } from "../Viewport";

/**
 *
 */
export interface OverlayInterface {
    /**
     *
     */
    drawFrame({
        viewports,
        meta_data,
    }: {
        viewports: Array<Viewport>;
        meta_data: CurrentFrameMetaData;
    }): OffscreenCanvas;

    /**
     *
     */
    addViewport({ viewport }: { viewport: Viewport }): void;

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void;

    /**
     *
     */
    release(): void;
}

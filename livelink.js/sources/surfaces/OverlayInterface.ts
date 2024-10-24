import type { CurrentFrameMetaData } from "../decoders/CurrentFrameMetaData";
import type { Viewport } from "../Viewport";

/**
 * @category Rendering
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
    }): OffscreenCanvas | null;

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

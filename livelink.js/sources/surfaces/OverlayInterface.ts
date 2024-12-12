import type { CurrentFrameMetaData } from "../decoders/CurrentFrameMetaData";
import type { Viewport } from "../Viewport";

/**
 * @category Rendering
 */
export interface OverlayInterface {
    /**
     *
     */
    draw({
        meta_data,
        output_canvas,
    }: {
        meta_data: CurrentFrameMetaData;
        output_canvas: OffscreenCanvas | null;
    }): OffscreenCanvas | null;

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void;

    /**
     *
     */
    release(): void;
}

import type { FrameMetaData } from "../decoders/FrameMetaData";

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
        meta_data: FrameMetaData;
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

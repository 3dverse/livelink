import type { FrameMetaData } from "../decoders/FrameMetaData";

/**
 * @category Rendering
 */
export interface OverlayInterface {
    /**
     *
     */
    draw({ output_canvas }: { output_canvas: OffscreenCanvas | null }): OffscreenCanvas | null;

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void;

    /**
     *
     */
    release(): void;
}

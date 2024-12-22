import { Rect } from "./Rect";
import { FrameMetaData } from "../decoders/FrameMetaData";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";

/**
 * @category Rendering
 */
export class VirtualSurface extends RenderingSurfaceBase {
    /**
     *
     */
    readonly #rect: Rect;

    /**
     *
     */
    get width() {
        return this.#rect.width;
    }

    /**
     *
     */
    get height() {
        return this.#rect.height;
    }

    /**
     *
     */
    constructor(width: number, height: number) {
        super();
        this.#rect = new Rect({ width, height });
    }

    /**
     *
     */
    getBoundingRect(): Rect {
        return this.#rect;
    }

    /**
     *
     */
    drawFrame(_: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData }): void {}
}

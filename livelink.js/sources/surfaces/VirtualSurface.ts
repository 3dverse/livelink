import { RenderingSurfaceBase } from "./RenderingSurfaceBase";
import { Rect } from "./Rect";
import { CurrentFrameMetaData } from "../decoders/CurrentFrameMetaData";

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
    drawFrame(_: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData }): void {}
}

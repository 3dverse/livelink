import { Rect, RenderingSurfaceBase } from "./RenderingSurfaceBase";
import { CurrentFrameMetaData } from "../decoders/EncodedFrameConsumer";

/**
 *
 */
export class NullSurface extends RenderingSurfaceBase {
    /**
     *
     */

    readonly width: number;
    /**
     *
     */
    readonly height: number;

    /**
     *
     */
    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
    }

    /**
     *
     */
    getBoundingRect(): Rect {
        return { left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height };
    }

    /**
     *
     */
    drawFrame(_: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData }): void {}
}

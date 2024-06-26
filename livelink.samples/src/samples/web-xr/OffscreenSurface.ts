import { ContextWebGL, RenderingSurfaceBase, Rect, Camera, CurrentFrameMetaData } from "@3dverse/livelink";

/**
 *
 */
export class OffscreenSurface extends RenderingSurfaceBase {
    /**
     * Virtual canvas on which we display the final composited frame.
     */
    #canvas: OffscreenCanvas;

    /**
     *
     */
    #context: ContextWebGL;

    /**
     *
     */
    #last_frame: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData } | null = null;

    /**
     *
     */
    constructor({ width, height }: { width: number; height: number }) {
        super();
        this.#canvas = new OffscreenCanvas(width, height);
        this.#context = new ContextWebGL(this.#canvas, "webgl", { xrCompatible: true });
    }

    /**
     *
     */
    get width(): number {
        return this.#canvas.width;
    }
    /**
     *
     */
    get height(): number {
        return this.#canvas.height;
    }

    /**
     *
     */
    get context() {
        return this.#context;
    }

    /**
     *
     */
    get cameras(): Readonly<Array<Camera>> {
        return this.viewports.map(v => v.camera).filter(c => c !== null) as Camera[];
    }

    /**
     *
     */
    release() {
        super.release();
        this.#context.release();
    }

    /**
     *
     */
    drawFrame(frame: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData }): void {
        this.#last_frame = frame;
    }

    /**
     *
     */
    getBoundingRect(): Rect {
        return {
            top: 0,
            left: 0,
            right: this.#canvas.width,
            bottom: this.#canvas.height,
            width: this.#canvas.width,
            height: this.#canvas.height,
        };
    }

    /**
     *
     */
    drawLastFrame() {
        if (this.#last_frame) {
            this.#context.drawFrame({ frame: this.#last_frame.frame, left: this.offset[0], top: this.offset[1] });
        }
    }

    /**
     *
     */
    resize(width: number, height: number) {
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#context.refreshSize();
    }
}

import {
    RenderingSurfaceBase,
    Rect,
    Camera,
    CurrentFrameMetaData,
    ContextProvider,
    CanvasContextType,
} from "@3dverse/livelink";

/**
 *
 */
export class OffscreenSurface<ContextType extends CanvasContextType, ContextOptions> extends RenderingSurfaceBase {
    /**
     * Virtual canvas on which we display the final composited frame.
     */
    #canvas: OffscreenCanvas;

    /**
     *
     */
    #context: ContextProvider;

    /**
     *
     */
    resolution_scale: number = 1.0;

    /**
     *
     */
    constructor({
        width,
        height,
        context_constructor,
        context_type,
        context_options,
    }: {
        width: number;
        height: number;
        context_constructor: new (
            canvas: HTMLCanvasElement | OffscreenCanvas,
            context_type: ContextType,
            options?: ContextOptions,
        ) => ContextProvider;
        context_type: ContextType;
        context_options?: ContextOptions;
    }) {
        super();

        //this.#canvas = new OffscreenCanvas(width, height);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        this.#canvas = canvas as unknown as OffscreenCanvas;

        this.#context = new context_constructor(this.#canvas, context_type, context_options);
    }

    /**
     *
     */
    get width(): number {
        return Math.floor(this.#canvas.width * this.resolution_scale);
    }
    /**
     *
     */
    get height(): number {
        return Math.floor(this.#canvas.height * this.resolution_scale);
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
    drawFrame(frame: {
        frame: VideoFrame | OffscreenCanvas;
        meta_data: CurrentFrameMetaData;
        left: number;
        top: number;
    }): void {
        this.#context.drawFrame(frame);
    }

    /**
     *
     */
    getBoundingRect(): Rect {
        return new Rect({ width: this.width, height: this.height });
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

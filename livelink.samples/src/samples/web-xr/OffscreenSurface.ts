import { RenderingSurfaceBase, Rect, Camera, CurrentFrameMetaData } from "@3dverse/livelink";
import { XRContext } from "./XRContext";

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
    #context: XRContext;

    /**
     *
     */
    #last_frame: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData } | null = null;

    /**
     *
     */
    resolution_scale: number = 1.0;

    /**
     *
     */
    scale_factor: number = 1.0;

    /**
     *
     */
    constructor({ width, height }: { width: number; height: number }) {
        super();
        //this.#canvas = new OffscreenCanvas(width, height);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        this.#canvas = canvas as unknown as OffscreenCanvas;

        this.#context = new XRContext(this.#canvas, "webgl", { xrCompatible: true });
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
    drawFrame(frame: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData }): void {
        this.#last_frame = frame;
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
    drawLastFrame(xr_views: Array<{ view: XRView; viewport: XRViewport }>) {
        if (this.#last_frame) {
            this.#context.drawFrame({
                frame: this.#last_frame.frame,
                left: this.offset[0],
                top: this.offset[1],
                scale_factor: this.scale_factor,
                xr_views: xr_views.map(({ view, viewport }, index) => {
                    const currentViewport = this.viewports[index];
                    const { position, orientation } = this.#last_frame!.meta_data.cameras.find(
                        c => c.camera.id === currentViewport.camera!.id,
                    )!;
                    return { view, viewport, frame_camera_transform: { position, orientation } };
                }),
            });
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

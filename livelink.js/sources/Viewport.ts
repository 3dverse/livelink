import { HighlightMode, ScreenSpaceRayResult, type Vec2 } from "@livelink.core";
import { Livelink } from "./Livelink";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { Camera } from "./Camera";

/**
 *
 */
export class Viewport extends EventTarget {
    /**
     * The Livelink core used to send commands.
     */
    #core: Livelink;

    /**
     * HTML canvas on which we display the final composited frame.
     */
    private _canvas: HTMLCanvasElement;
    /**
     *
     */
    private _context: CanvasRenderingContext2D;
    /**
     *
     */
    private _auto_resizer: CanvasAutoResizer;
    /**
     *
     */
    private _camera: Camera | null = null;

    /**
     * HTML Canvas Element
     */
    get canvas() {
        return this._canvas;
    }

    /**
     * Dimensions of the HTML canvas in pixels.
     */
    get width(): number {
        return this._canvas.width;
    }
    get height(): number {
        return this._canvas.height;
    }
    get dimensions(): Vec2 {
        return [this.width, this.height];
    }

    /**
     *
     */
    get camera(): Camera | null {
        return this._camera;
    }

    /**
     *
     */
    set camera(c: Camera) {
        this._camera = c;
    }

    /**
     * @param canvas_element DOM Element or id of the canvas on which to display the final composited frame
     *
     * @throws {InvalidCanvasId} Thrown when the provided id doesn't refer to a canvas element.
     */
    constructor(
        core: Livelink,
        {
            canvas_element,
        }: {
            canvas_element: string | HTMLCanvasElement;
        },
    ) {
        super();
        this.#core = core;

        const canvas = typeof canvas_element === "string" ? document.getElementById(canvas_element) : canvas_element;

        if (canvas === null) {
            throw new Error(`Cannot find canvas ${canvas_element}`);
        }

        if (canvas.nodeName !== "CANVAS") {
            throw new Error(`HTML element ${canvas_element} is a '${canvas.nodeName}', it MUST be CANVAS`);
        }
        const context = (canvas as HTMLCanvasElement).getContext("2d");
        if (context === null) {
            throw new Error(`Cannot create a 2d context from canvas ${canvas_element}`);
        }

        this._canvas = canvas as HTMLCanvasElement;
        this._auto_resizer = new CanvasAutoResizer(this);
        this._context = context;
    }

    /**
     *
     */
    async init(): Promise<Viewport> {
        await this._auto_resizer.waitForFirstResize();
        return this;
    }

    /**
     *
     */
    isValid(): boolean {
        return this._camera !== null && this.width > 0 && this.height > 0;
    }

    /**
     *
     */
    drawFrame({ decoded_frame, left, top }: { decoded_frame: VideoFrame; left: number; top: number }): void {
        this._context.drawImage(decoded_frame, left, top, this.width, this.height, 0, 0, this.width, this.height);
    }

    /**
     *
     */
    async castScreenSpaceRay({
        pos,
        mode = HighlightMode.None,
    }: {
        pos: Vec2;
        mode: HighlightMode;
    }): Promise<ScreenSpaceRayResult | null> {
        return this._camera && this._camera.rtid
            ? await this.#core!.castScreenSpaceRay({
                  screenSpaceRayQuery: {
                      camera_rtid: this._camera.rtid,
                      pos,
                      mode,
                  },
              })
            : null;
    }

    /**
     *
     */
    updateCanvasSize() {
        this.#core.remote_rendering_surface.update();
    }
}

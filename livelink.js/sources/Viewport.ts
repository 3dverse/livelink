import { HighlightMode, ScreenSpaceRayResult, type Vec2, Entity } from "@livelink.core";
import { Livelink } from "./Livelink";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { Camera } from "./Camera";
import { ContextWebGL } from "./contexts/ContextWebGL";
import { Context2D } from "./contexts/Context2D";
import { ContextProvider } from "./contexts/ContextProvider";

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
    private _context: ContextProvider;
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
        return this._canvas.clientWidth;
    }
    get height(): number {
        return this._canvas.clientHeight;
    }
    get dimensions(): Vec2 {
        return [this.width, this.height];
    }
    get aspect_ratio(): number {
        return this.height > 0 ? this.width / this.height : 1;
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
            context_type,
        }: {
            canvas_element: string | HTMLCanvasElement;
            context_type: "2d" | "webgl" | "webgl2";
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

        this._canvas = canvas as HTMLCanvasElement;
        switch (context_type) {
            case "2d":
                this._context = new Context2D(this._canvas);
                break;
            case "webgl":
            case "webgl2":
                this._context = new ContextWebGL(this._canvas, context_type);
                break;
        }

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this._auto_resizer = new CanvasAutoResizer(this);
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
    release() {
        this.deactivatePicking();
        this._auto_resizer.release();
        this._context.release();
    }

    /**
     *
     */
    drawFrame({ decoded_frame, left, top }: { decoded_frame: VideoFrame; left: number; top: number }): void {
        this._context.drawFrame({ frame: decoded_frame, left, top });
    }

    /**
     *
     */
    activatePicking() {
        this._canvas.addEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    deactivatePicking() {
        this._canvas.removeEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    #onCanvasClicked = async (e: MouseEvent) => {
        const pos: Vec2 = [
            e.offsetX / (this._canvas.clientWidth - this._canvas.clientLeft),
            e.offsetY / (this._canvas.clientHeight - this._canvas.clientTop),
        ];

        const picked_entity = await this.castScreenSpaceRay({
            pos,
            mode: HighlightMode.HighlightAndDiscardOldSelection,
        });

        this.dispatchEvent(new CustomEvent("on-entity-picked", { detail: { picked_entity } }));
    };

    /**
     *
     */
    async castScreenSpaceRay({
        pos,
        mode = HighlightMode.None,
    }: {
        pos: Vec2;
        mode: HighlightMode;
    }): Promise<Entity | null> {
        if (!this._camera || !this._camera.rtid) {
            return null;
        }

        const res = await this.#core.castScreenSpaceRay({
            screenSpaceRayQuery: {
                camera_rtid: this._camera.rtid,
                pos,
                mode,
            },
        });

        if (res.entity_rtid === null) {
            return null;
        }

        return await this.#core.scene.getEntity({ entity_rtid: res.entity_rtid });
    }

    /**
     * @internal
     */
    _updateCanvasSize() {
        this._context.refreshSize();
        this.dispatchEvent(new Event("on-resized"));
    }
}

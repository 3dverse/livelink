import type { HighlightMode, Vec2, Vec3 } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";

import { Livelink } from "./Livelink";
import { Context2D } from "./contexts/Context2D";
import { ContextWebGL } from "./contexts/ContextWebGL";
import { ContextProvider } from "./contexts/ContextProvider";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { Camera } from "./Camera";
import { Entity } from "./Entity";

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
    #canvas: HTMLCanvasElement;
    /**
     *
     */
    #context: ContextProvider;
    /**
     *
     */
    #auto_resizer: CanvasAutoResizer;
    /**
     *
     */
    #camera: Camera | null = null;

    /**
     * HTML Canvas Element
     */
    get canvas() {
        return this.#canvas;
    }

    /**
     * Dimensions of the HTML canvas in pixels.
     */
    get width(): number {
        return this.#canvas.clientWidth;
    }
    get height(): number {
        return this.#canvas.clientHeight;
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
        return this.#camera;
    }

    /**
     *
     */
    set camera(c: Camera) {
        this.#camera = c;
        c.viewport = this;
        this.#core.refreshViewports();
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

        this.#canvas = canvas as HTMLCanvasElement;
        switch (context_type) {
            case "2d":
                this.#context = new Context2D(this.#canvas);
                break;
            case "webgl":
            case "webgl2":
                this.#context = new ContextWebGL(this.#canvas, context_type);
                break;
        }

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.#auto_resizer = new CanvasAutoResizer(this);
    }

    /**
     *
     */
    isValid(): boolean {
        return this.#camera !== null && this.width > 0 && this.height > 0;
    }

    /**
     *
     */
    release() {
        this.deactivatePicking();
        this.#auto_resizer.release();
        this.#context.release();
    }

    /**
     *
     */
    drawFrame({ decoded_frame, left, top }: { decoded_frame: VideoFrame; left: number; top: number }): void {
        this.#context.drawFrame({ frame: decoded_frame, left, top });
    }

    /**
     *
     */
    activatePicking() {
        this.#canvas.addEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    deactivatePicking() {
        this.#canvas.removeEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    #onCanvasClicked = async (e: MouseEvent) => {
        const pos: Vec2 = [
            e.offsetX / (this.#canvas.clientWidth - this.#canvas.clientLeft),
            e.offsetY / (this.#canvas.clientHeight - this.#canvas.clientTop),
        ];

        const res = await this.castScreenSpaceRay({
            pos,
            mode: LivelinkCoreModule.Enums.HighlightMode.HighlightAndDiscardOldSelection,
        });

        this.dispatchEvent(new CustomEvent("on-entity-picked", { detail: res }));
    };

    /**
     *
     */
    async castScreenSpaceRay({
        pos,
        mode = LivelinkCoreModule.Enums.HighlightMode.None,
    }: {
        pos: Vec2;
        mode: HighlightMode;
    }): Promise<{ entity: Entity; ws_position: Vec3; ws_normal: Vec3 } | null> {
        if (!this.#camera || !this.#camera.rtid) {
            return null;
        }

        const res = await this.#core._castScreenSpaceRay({
            screenSpaceRayQuery: {
                camera_rtid: this.#camera.rtid,
                pos,
                mode,
            },
        });

        if (res.entity_rtid === null) {
            return null;
        }

        const entity = await this.#core.scene.getEntity({ entity_rtid: res.entity_rtid });
        if (entity === null) {
            return null;
        }

        return { entity, ws_position: res.position, ws_normal: res.normal };
    }

    /**
     * @internal
     */
    _updateCanvasSize() {
        this.#context.refreshSize();
        this.dispatchEvent(new Event("on-resized"));
    }
}

import { Context2D } from "../contexts/Context2D";
import { ContextWebGL } from "../contexts/ContextWebGL";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";
import { Rect } from "./Rect";

import type { Vec2 } from "@3dverse/livelink.core";
import type { ContextProvider } from "../contexts/ContextProvider";
import type { FrameMetaData } from "../decoders/FrameMetaData";

/**
 * @category Rendering
 */
export type CanvasContextAttributes =
    | CanvasRenderingContext2DSettings
    | (WebGLContextAttributes & { xrCompatible?: boolean });

/**
 * @category Rendering
 */
export type CanvasContextType = "2d" | "webgl" | "webgl2";

/**
 * @category Rendering
 */
export class RenderingSurface extends RenderingSurfaceBase {
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
     * HTML Canvas Element
     */
    get canvas(): HTMLCanvasElement {
        return this.#canvas;
    }

    /**
     *
     */
    constructor({
        canvas_element,
        context_type,
        context_attributes,
    }: {
        canvas_element: string | HTMLCanvasElement;
    } & (
        | { context_type: "2d"; context_attributes?: CanvasRenderingContext2DSettings }
        | {
              context_type: "webgl" | "webgl2";
              context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean };
          }
    )) {
        super();

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
                this.#context = new ContextWebGL(this.#canvas, context_type, context_attributes);
                break;
        }

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.#auto_resizer = new CanvasAutoResizer(this.canvas);
        this.#auto_resizer.addEventListener("on-resized", this.#onCanvasResized);
        this.#context.refreshSize();
    }

    /**
     *
     */
    release(): void {
        this.#auto_resizer.release();
        this.#context.release();
    }

    /**
     *
     */
    #onCanvasResized = (): void => {
        this.#context.refreshSize();
        this.dispatchEvent(new Event("on-resized"));

        for (const viewport of this.viewports) {
            viewport.onResize();
        }
    };

    /**
     *
     */
    getContext<ContextType extends ContextProvider>(): ContextType {
        return this.#context as ContextType;
    }

    /**
     *
     */
    getBoundingRect(): Rect {
        const rect = this.canvas.getClientRects()[0];
        // If the canvas css uses em or % positioning values or the web browser page is zoomed, then the rect might
        // have floating point values that would differ from the canvas element clientWidth & clientHeight used by
        // RenderingSurfaceBase.getViewportConfigs(rect.width, rect.height). So it needs to be ceiled to prevent
        // normalized width or height superior to 1 in the viewport config.
        if (rect) {
            rect.x = Math.ceil(rect.x);
            rect.y = Math.ceil(rect.y);
            rect.width = Math.ceil(rect.width);
            rect.height = Math.ceil(rect.height);
        }
        return new Rect(rect ?? { width: this.canvas.width, height: this.canvas.height });
    }

    /**
     *
     */
    drawFrame({ frame, meta_data }: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData }): void {
        this.#context.drawFrame({ frame, left: this.offset[0], top: this.offset[1], meta_data });

        for (const viewport of this.viewports) {
            const overlayFrame = viewport.drawOverlays();
            if (!overlayFrame) {
                continue;
            }
            this.#context.drawFrame({
                frame: overlayFrame,
                left: viewport.offset[0],
                top: viewport.offset[1],
                meta_data,
            });
        }
    }
}

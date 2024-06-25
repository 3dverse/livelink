import { Vec2 } from "@3dverse/livelink.core";
import { Context2D } from "../contexts/Context2D";
import { ContextProvider } from "../contexts/ContextProvider";
import { ContextWebGL } from "../contexts/ContextWebGL";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { Rect, RenderingSurfaceBase } from "./RenderingSurfaceBase";

/**
 *
 */
export type CanvasContextAttributes =
    | CanvasRenderingContext2DSettings
    | (WebGLContextAttributes & { xrCompatible?: boolean });

/**
 *
 */
export type CanvasContextType = "2d" | "webgl" | "webgl2";

/**
 *
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
    get canvas() {
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
    #onCanvasResized = () => {
        this.#context.refreshSize();
        this.dispatchEvent(new Event("on-resized"));
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
        return (
            rect ?? {
                left: 0,
                top: 0,
                right: this.canvas.width,
                bottom: this.canvas.height,
                width: this.canvas.width,
                height: this.canvas.height,
            }
        );
    }

    /**
     *
     */
    drawFrame({ frame }: { frame: VideoFrame | OffscreenCanvas }): void {
        this.#context.drawFrame({ frame, left: this.offset[0], top: this.offset[1] });
    }
}

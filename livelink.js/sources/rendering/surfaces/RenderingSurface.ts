import * as bowser from "bowser";

import { Context2D } from "../contexts/Context2D";
import { ContextIOS } from "../contexts/ContextIOS";
import { ContextWebGL } from "../contexts/ContextWebGL";
import { CanvasAutoResizer } from "./CanvasAutoResizer";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";
import { Rect, RelativeRect } from "./Rect";

import type { Vec2i } from "@3dverse/livelink.core";
import type { ContextProvider } from "../contexts/ContextProvider";
import { RenderingSurfaceResizedEvent } from "./RenderingSurfaceEvents";
import { DecodedFrame } from "../streaming/EncodedFrameConsumer";

/**
 * @category Rendering Contexts
 */
export type CanvasContextAttributes =
    | CanvasRenderingContext2DSettings
    | (WebGLContextAttributes & { xrCompatible?: boolean });

/**
 * @category Rendering Contexts
 */
export type CanvasContextType = "2d" | "webgl" | "webgl2";

/**
 * A rendering surface backed by an HTML canvas.
 *
 * The context can be specified as either 2D, WebGL or WebGL2 along with its attributes.
 *
 * The canvas is automatically resized to match the size of the HTML element it is attached to.
 *
 * @category Rendering Surfaces
 */
export class RenderingSurface extends RenderingSurfaceBase {
    /**
     * HTML canvas on which we display the final composited frame.
     */
    #canvas: HTMLCanvasElement;

    /**
     * The context used to draw the frame.
     */
    #context: ContextProvider;

    /**
     * The auto resizer for the canvas.
     */
    #auto_resizer: CanvasAutoResizer;

    /**
     * Width of the surface.
     */
    get width(): number {
        return this.#canvas.clientWidth * this._scale;
    }

    /**
     * Height of the surface.
     */
    get height(): number {
        return this.#canvas.clientHeight * this._scale;
    }

    /**
     * HTML canvas on which the final frame is displayed.
     */
    get canvas(): HTMLCanvasElement {
        return this.#canvas;
    }

    /**
     * Creates a new rendering surface.
     *
     * @param params
     * @param params.canvas_element - The HTML canvas element or its id.
     * @param params.context_type - The type of context to create.
     * @param params.context_attributes - The attributes of the context.
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

        const browser = bowser.getParser(navigator.userAgent);
        const isIOS = browser.getOSName(true) === "ios";

        this.#canvas = canvas as HTMLCanvasElement;
        switch (context_type) {
            case "2d":
                this.#context = isIOS ? new ContextIOS(this.#canvas) : new Context2D(this.#canvas);
                break;
            case "webgl":
            case "webgl2":
                this.#context = new ContextWebGL(this.#canvas, context_type, context_attributes);
                break;
        }

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.#auto_resizer = new CanvasAutoResizer({ canvas: this.canvas, onResized: this.#onCanvasResized });
        this.#context.refreshSize();
    }

    /**
     * Releases the resources associated with the surface.
     */
    override release(): void {
        super.release();

        this.#auto_resizer.release();
        this.#context.release();
    }

    /**
     * Returns the context of the surface.
     */
    getContext<ContextType extends ContextProvider>(): ContextType {
        return this.#context as ContextType;
    }

    /**
     * Returns the bounding rectangle of the surface.
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
            rect.width = Math.ceil(rect.width * this._scale);
            rect.height = Math.ceil(rect.height * this._scale);
        }
        return new Rect(rect ?? { width: this.canvas.width, height: this.canvas.height });
    }

    /**
     * @internal
     *
     * Refresh scale of the surface.
     */
    protected _onScaleUpdated(): void {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.#context.refreshSize();
    }

    /**
     * @internal
     */
    protected _drawFrame({ decoded_frame }: { decoded_frame: DecodedFrame }): void {
        this.#context.drawFrameSection({
            frame_section: {
                pixels: decoded_frame.pixels,
                dimensions_in_pixels: decoded_frame.dimensions_in_pixels,
                meta_data: decoded_frame.meta_data,
                section: this.relative_rect,
            },
            viewport: RelativeRect.default,
        });

        for (const viewport of this.viewports) {
            const overlayFrame = viewport._drawOverlays();
            if (!overlayFrame) {
                continue;
            }

            this.#context.drawFrameSection({
                frame_section: {
                    pixels: overlayFrame,
                    dimensions_in_pixels: [overlayFrame.width, overlayFrame.height],
                    meta_data: decoded_frame.meta_data,
                    section: RelativeRect.default,
                },
                viewport: viewport.relative_rect,
            });
        }
    }

    /**
     * Resizes the surface.
     */
    #onCanvasResized = (_: { old_size: Vec2i; new_size: Vec2i }): void => {
        this.#context.refreshSize();
        this._dispatchEvent(new RenderingSurfaceResizedEvent());
    };
}

//------------------------------------------------------------------------------
import { Rect, RelativeRect } from "./Rect";
import { Entity } from "../../scene/Entity";
import { CanvasContextType } from "./RenderingSurface";
import { ContextProvider } from "../contexts/ContextProvider";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";
import { RenderingSurfaceResizedEvent } from "./RenderingSurfaceEvents";
import { DecodedFrame } from "../streaming/EncodedFrameConsumer";

/**
 * @category Rendering Surfaces
 */
export class OffscreenSurface<ContextType extends CanvasContextType, ContextOptions> extends RenderingSurfaceBase {
    /**
     * Virtual canvas on which we display the final composited frame.
     */
    #canvas: HTMLCanvasElement;

    /**
     *
     */
    #context: ContextProvider;

    /**
     *
     */
    #resolution_scale: number;

    /**
     *
     */
    constructor({
        width,
        height,
        context_constructor,
        context_type,
        context_options,
        resolution_scale = 1.0,
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
        resolution_scale: number;
    }) {
        super();

        this.#canvas = document.createElement("canvas");
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#context = new context_constructor(this.#canvas, context_type, context_options);
        this.#resolution_scale = resolution_scale;
    }

    /**
     *
     */
    get width(): number {
        return Math.floor(this.#canvas.width * this.#resolution_scale);
    }
    /**
     *
     */
    get height(): number {
        return Math.floor(this.#canvas.height * this.#resolution_scale);
    }

    /**
     *
     */
    get context(): ContextProvider {
        return this.#context;
    }

    /**
     *
     */
    get cameras(): readonly Entity[] {
        return this.viewports
            .map(v => (v.camera_projection?.camera_entity ? v.camera_projection.camera_entity : null))
            .filter(c => c !== null);
    }

    /**
     *
     */
    override release(): void {
        super.release();
        this.#context.release();
    }

    /**
     * @internal
     */
    protected _drawFrame({ decoded_frame }: { decoded_frame: DecodedFrame }): void {
        this.#context.drawFrameSection({
            frame_section: {
                pixels: decoded_frame.pixels,
                section: this.relative_rect,
                dimensions_in_pixels: decoded_frame.dimensions_in_pixels,
                meta_data: decoded_frame.meta_data,
            },
            viewport: RelativeRect.default,
        });
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
    resize(width: number, height: number): void {
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#context.refreshSize();
    }

    /**
     *
     */
    get resolution_scale(): number {
        return this.#resolution_scale;
    }

    /**
     *
     */
    set resolution_scale(scale: number) {
        if (this.#resolution_scale !== scale) {
            this.#resolution_scale = scale;
            this._dispatchEvent(new RenderingSurfaceResizedEvent());
        }
    }
}

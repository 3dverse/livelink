//------------------------------------------------------------------------------
import { Rect } from "./Rect";
import { Entity } from "../../scene/Entity";
import { CanvasContextType } from "./RenderingSurface";
import { FrameMetaData } from "../decoders/FrameMetaData";
import { ContextProvider } from "../contexts/ContextProvider";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";

/**
 * @category Rendering
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
    release(): void {
        super.release();
        this.#context.release();
    }

    /**
     *
     */
    drawFrame(frame: {
        frame: VideoFrame | OffscreenCanvas;
        left: number;
        top: number;
        meta_data: FrameMetaData;
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
        this.#resolution_scale = scale;
        this.dispatchEvent(new Event("on-resized"));
    }
}

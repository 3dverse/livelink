//------------------------------------------------------------------------------
import { Rect, RelativeRect } from "./Rect";
import { Entity } from "../../scene/Entity";
import { CanvasContextType } from "./RenderingSurface";
import { ContextProvider } from "../contexts/ContextProvider";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";
import { DecodedFrame } from "../streaming/EncodedFrameConsumer";
import { RenderingSurfaceResizedEvent } from "./RenderingSurfaceEvents";

/**
 * @category Rendering Surfaces
 */
export class OffscreenSurface<ContextType extends CanvasContextType, ContextOptions> extends RenderingSurfaceBase {
    /**
     * Virtual canvas on which we display the final composited frame.
     */
    #canvas: HTMLCanvasElement;

    /**
     * The context used to draw the frame.
     */
    #context: ContextProvider;

    /**
     * Width of the surface.
     */
    get width(): number {
        return Math.floor(this.#canvas.width * this.scale);
    }

    /**
     * Height of the surface.
     */
    get height(): number {
        return Math.floor(this.#canvas.height * this.scale);
    }

    /**
     * The cameras associated with the surface's viewports.
     */
    get cameras(): readonly Entity[] {
        // TODO: review WebXRHelper which is the only consumer of this and
        // remove this getter which has probably not its place here.
        return this.viewports
            .map(v => (v.camera_projection?.camera_entity ? v.camera_projection.camera_entity : null))
            .filter(c => c !== null);
    }

    /**
     * Creates a new offscreen surface.
     *
     * @param params
     * @param params.width - The width of the offscreen canvas.
     * @param params.height - The height of the offscreen canvas.
     * @param params.context_constructor - The constructor of the context.
     * @param params.context_type - The type of context to create.
     * @param params.context_attributes - The attributes of the context.
     */
    constructor({
        width,
        height,
        context_constructor,
        context_type,
        context_attributes,
    }: {
        width: number;
        height: number;
        context_constructor: new (
            canvas: HTMLCanvasElement | OffscreenCanvas,
            context_type: ContextType,
            options?: ContextOptions,
        ) => ContextProvider;
        context_type: ContextType;
        context_attributes?: ContextOptions;
    }) {
        super();

        this.#canvas = document.createElement("canvas");
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#context = new context_constructor(this.#canvas, context_type, context_attributes);
    }

    /**
     * Releases the resources associated with the surface.
     */
    override release(): void {
        super.release();
        this.#context.release();
    }

    /**
     * Returns the context of the surface.
     */
    getContext<ContextType extends ContextProvider>(): ContextType {
        return this.#context as ContextType;
    }

    /**
     *
     */
    getBoundingRect(): Rect {
        return new Rect({ width: this.width, height: this.height });
    }

    /**
     * Resizes the surface.
     */
    resize(width: number, height: number): void {
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#context.refreshSize();
        this._dispatchEvent(new RenderingSurfaceResizedEvent());
    }

    /**
     * @internal
     *
     * Refresh the scale of the surface.
     */
    protected override _onScaleUpdated(): void {
        this.#context.refreshSize();
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
}

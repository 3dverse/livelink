import { Context2D } from "./Context2D";
import type { FrameSection } from "./ContextProvider";
import type { RelativeRect } from "../surfaces/Rect";

/**
 * @category Rendering Contexts
 */
export class ContextIOS extends Context2D {
    /**
     *
     */
    #offscreen_canvas: OffscreenCanvas;

    /**
     *
     */
    #offscreen_context2D: OffscreenCanvasRenderingContext2D;

    /**
     *
     */
    constructor(canvas: HTMLCanvasElement, context_attributes?: CanvasRenderingContext2DSettings) {
        super(canvas, context_attributes);

        this.#offscreen_canvas = new OffscreenCanvas(canvas.width, canvas.height);
        const offscreen_context = this.#offscreen_canvas.getContext("2d", context_attributes);
        if (offscreen_context === null) {
            throw new Error(`Cannot create a 2d context from offscreen canvas ${this.#offscreen_canvas}`);
        }
        this.#offscreen_context2D = offscreen_context;
        this.refreshSize();
    }

    /**
     * on iOS, Canvas 2D context does not support VideoFrame correctly as source.
     * The image is not correctly blitted to the canvas.
     * We need to draw the VideoFrame into an OffscreenCanvas first,
     * then use the OffscreenCanvas as source as a workaround.
     */
    override drawFrameSection({
        frame_section,
        viewport,
    }: {
        frame_section: FrameSection;
        viewport: RelativeRect;
    }): void {
        // if not a VideoFrame, use the default implementation
        if (!(frame_section.pixels instanceof VideoFrame)) {
            super.drawFrameSection({ frame_section, viewport });
            return;
        }

        if (frame_section.dimensions_in_pixels[0] !== this.#offscreen_canvas.width) {
            this.#offscreen_canvas.width = frame_section.dimensions_in_pixels[0];
        }
        if (frame_section.dimensions_in_pixels[1] !== this.#offscreen_canvas.height) {
            this.#offscreen_canvas.height = frame_section.dimensions_in_pixels[1];
        }

        this.#offscreen_context2D.drawImage(frame_section.pixels, 0, 0);
        super.drawFrameSection({
            frame_section: {
                ...frame_section,
                pixels: this.#offscreen_canvas,
            },
            viewport: viewport,
        });
    }

    /**
     *
     */
    override release(): void {
        super.release();
        this.#offscreen_context2D.reset();
    }
}

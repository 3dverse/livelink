import { ContextProvider, type FrameSection } from "./ContextProvider";
import type { RelativeRect } from "../surfaces/Rect";

/**
 * @category Rendering Contexts
 */
export class Context2D extends ContextProvider {
    /**
     *
     */
    #canvas: HTMLCanvasElement;

    /**
     *
     */
    #context2D: CanvasRenderingContext2D;

    /**
     *
     */
    constructor(canvas: HTMLCanvasElement, context_attributes?: CanvasRenderingContext2DSettings) {
        super();

        const context = canvas.getContext("2d", context_attributes);
        if (context === null) {
            throw new Error(`Cannot create a 2d context from canvas ${canvas}`);
        }
        this.#canvas = canvas;
        this.#context2D = context;
    }

    /**
     *
     */
    drawFrameSection({ frame_section, viewport }: { frame_section: FrameSection; viewport: RelativeRect }): void {
        const frame_offset_left = frame_section.section.left * frame_section.dimensions_in_pixels[0];
        const frame_offset_top = frame_section.section.top * frame_section.dimensions_in_pixels[1];
        const frame_width = frame_section.section.width * frame_section.dimensions_in_pixels[0];
        const frame_height = frame_section.section.height * frame_section.dimensions_in_pixels[1];

        const viewport_offset_left = viewport.left * this.#canvas.width;
        const viewport_offset_top = viewport.top * this.#canvas.height;
        const viewport_width = viewport.width * this.#canvas.width;
        const viewport_height = viewport.height * this.#canvas.height;

        this.#context2D.drawImage(
            frame_section.pixels,
            frame_offset_left,
            frame_offset_top,
            frame_width,
            frame_height,
            viewport_offset_left,
            viewport_offset_top,
            viewport_width,
            viewport_height,
        );
    }

    /**
     *
     */
    release(): void {
        this.#context2D.reset();
    }
}

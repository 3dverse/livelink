import { Rect } from "./Rect";
import { RenderingSurfaceBase } from "./RenderingSurfaceBase";

/**
 * A virtual rendering surface.
 *
 * A virtual surface is a surface that is not backed by a physical canvas.
 * It is used to represent a surface that is not directly rendered to the screen.
 *
 * Its main usecase is for video recording, where the frame rendered by the server is consumed
 * as is and put directly into a video file.
 *
 * @category Rendering
 */
export class VirtualSurface extends RenderingSurfaceBase {
    /**
     * The bounding rectangle of the surface.
     */
    readonly #rect: Rect;

    /**
     * Width of the surface.
     */
    get width(): number {
        return this.#rect.width;
    }

    /**
     * Height of the surface.
     */
    get height(): number {
        return this.#rect.height;
    }

    /**
     * Creates a new virtual surface.
     */
    constructor({ width, height }: { width: number; height: number }) {
        super();
        this.#rect = new Rect({ width, height });
    }

    /**
     * Returns the bounding rectangle of the surface.
     */
    getBoundingRect(): Rect {
        return this.#rect;
    }

    /**
     * Do nothing.
     */
    _drawFrame(): void {}
}

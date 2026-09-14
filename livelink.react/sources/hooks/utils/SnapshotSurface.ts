//------------------------------------------------------------------------------
import { ContextWebGL, OffscreenSurface, Rect } from "@3dverse/livelink";

/**
 * @internal
 *
 * An {@link OffscreenSurface} for capturing still images of arbitrary points of view. Adds
 * canvas access and a virtual position, both missing from `OffscreenSurface`.
 */
export class SnapshotSurface extends OffscreenSurface<"webgl", WebGLContextAttributes> {
    /**
     * Virtual position, so this surface doesn't overlap the visible one once both are packed
     * into the shared remote canvas. See {@link getBoundingRect}.
     */
    readonly #offset: { left: number; top: number };

    /**
     *
     */
    constructor({
        width,
        height,
        offset = { left: 0, top: 0 },
    }: {
        width: number;
        height: number;
        offset?: { left: number; top: number };
    }) {
        super({
            width,
            height,
            context_constructor: ContextWebGL,
            context_type: "webgl",
            // Needed for toDataURL()/toBlob() to read back the last frame on a canvas that's
            // never inserted into the DOM.
            context_attributes: { preserveDrawingBuffer: true },
        });
        this.#offset = offset;
    }

    /**
     * `OffscreenSurface` doesn't expose its canvas; reach it through the WebGL context instead.
     */
    get canvas(): HTMLCanvasElement {
        return this.getContext<ContextWebGL>().native.canvas as HTMLCanvasElement;
    }

    /**
     * Reports {@link #offset} instead of the real (0,0)-anchored position `OffscreenSurface`
     * would otherwise use.
     */
    override getBoundingRect(): Rect {
        return new Rect({ left: this.#offset.left, top: this.#offset.top, width: this.width, height: this.height });
    }
}

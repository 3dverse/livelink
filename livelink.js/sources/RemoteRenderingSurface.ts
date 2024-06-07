import type { Vec2i, Vec2ui16, ViewportConfig } from "livelink.core";
import { Livelink } from "./Livelink";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";
import { Viewport } from "./Viewport";

type ViewportRect = {
    viewport: Viewport;
    offset: Vec2i;
};

/**
 * A remote rendering surface represents the total available area for the remote
 * renderer to draw on.
 * The dimensions of this surface MUST be divisble by 8 for the encoder to work
 * properly.
 *
 * This drawing area is split into viewports. Each viewport must have an
 * associated camera.
 * Note that viewports will be packed arbitrarily on the rendering surface.
 *
 * The surface is also responsible of decoding the encoded frame return by the
 * renderer and spliting the decoded frame into areas corresponding to their
 * respective viewports.
 */
export class RemoteRenderingSurface implements DecodedFrameConsumer {
    /**
     *
     */
    #core: Livelink;

    /**
     * List of viewports and their offsets.
     */
    #viewports: Array<ViewportRect> = [];

    /**
     * Surface actual dimensions.
     */
    #dimensions: Vec2ui16 = [0, 0];

    /**
     * Returns the surface dimensions in pixels rounded up to the next multiple
     * of 8.
     */
    get dimensions(): Vec2ui16 {
        return this.#dimensions;
    }

    /**
     *
     */
    private get config(): Array<ViewportConfig> {
        return this.#viewports.map(({ viewport, offset }) => ({
            camera_rtid: viewport.camera!.rtid!,
            left: offset[0] / this.dimensions[0],
            top: offset[1] / this.dimensions[1],
            width: viewport.width / this.dimensions[0],
            height: viewport.height / this.dimensions[1],
        }));
    }

    /**
     *
     */
    constructor(core: Livelink) {
        this.#core = core;
    }

    /**
     *
     */
    consumeDecodedFrame({ decoded_frame }: { decoded_frame: VideoFrame }): void {
        for (const { viewport, offset } of this.#viewports) {
            viewport.drawFrame({
                decoded_frame,
                left: offset[0],
                top: offset[1],
            });
        }
    }

    /**
     * Attach a viewport to the surface
     *
     * @param viewport The viewport to attach to the surface
     */
    addViewport({ viewport }: { viewport: Viewport }): void {
        this.addViewports({ viewports: [viewport] });
    }

    /**
     * Attach viewports to the surface
     *
     * @param viewports The viewports to attach to the surface
     */
    addViewports({ viewports }: { viewports: Array<Viewport> }): void {
        for (const viewport of viewports) {
            this.#viewports.push({ viewport, offset: [0, 0] });
            viewport.addEventListener("on-resized", this.#onViewportResized);
        }

        this.#onViewportResized();
    }

    /**
     *
     */
    init() {
        this.#onViewportResized();
    }

    /**
     *
     */
    cleanUp() {
        for (const v of this.#viewports) {
            v.viewport.cleanUp();
        }
    }

    /**
     *
     */
    #isValid(): boolean {
        return this.#viewports.every(({ viewport }) => viewport.isValid());
    }

    /**
     *
     */
    #onViewportResized = () => {
        const need_to_resize = this.#computeSurfaceSize();

        if (this.#core.isConfigured() && this.#isValid()) {
            if (need_to_resize) {
                this.#core.resize({ size: this.#dimensions });
            }
            this.#core.setViewports({ viewports: this.config });
        }
    };

    /**
     *
     */
    #computeSurfaceSize(): boolean {
        const { offset, width, height } = this.#computeBoundingRect();
        this.#computeViewportsOffsets(offset);

        const next_multiple_of_8 = (n: number) =>
            Math.floor(n) + (Math.floor(n) % 8 === 0 ? 0 : 8 - (Math.floor(n) % 8));
        const new_dimensions: Vec2i = [next_multiple_of_8(width), next_multiple_of_8(height)];

        const need_to_resize = new_dimensions[0] != this.#dimensions[0] || new_dimensions[1] != this.dimensions[1];

        this.#dimensions = new_dimensions;

        return need_to_resize;
    }

    /**
     *
     */
    #computeBoundingRect(): { offset: Vec2i; width: number; height: number } {
        let min: Vec2i = [Number.MAX_VALUE, Number.MAX_VALUE];
        let max: Vec2i = [0, 0];

        for (const { viewport } of this.#viewports) {
            const clientRect = viewport.canvas.getClientRects()[0];
            min[0] = Math.min(min[0], clientRect.left);
            min[1] = Math.min(min[1], clientRect.top);
            max[0] = Math.max(max[0], clientRect.right);
            max[1] = Math.max(max[1], clientRect.bottom);
        }

        const width = max[0] - min[0];
        const height = max[1] - min[1];

        return { offset: min, width, height };
    }

    /**
     *
     */
    #computeViewportsOffsets(client_rect_offset: Vec2i) {
        for (const { viewport, offset } of this.#viewports) {
            const clientRect = viewport.canvas.getClientRects()[0];
            offset[0] = clientRect.left - client_rect_offset[0];
            offset[1] = clientRect.top - client_rect_offset[1];
        }
    }
}

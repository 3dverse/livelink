import type { Vec2, Vec2ui16, ViewportConfig } from "livelink.core";
import { Livelink } from "./Livelink";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";
import { Viewport } from "./Viewport";

type ViewportRect = {
    viewport: Viewport;
    offset: Vec2;
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
    private _viewports: Array<ViewportRect> = [];

    /**
     * Surface actual dimensions.
     */
    private _dimensions: Vec2ui16 = [0, 0];

    /**
     * Current offset to apply to the next viewport to be added.
     */
    private _current_offset = 0;

    /**
     * Returns the surface dimensions in pixels rounded up to the next multiple
     * of 8.
     */
    get dimensions(): Vec2ui16 {
        return this._dimensions;
    }

    /**
     *
     */
    private get config(): Array<ViewportConfig> {
        return this._viewports.map(({ viewport, offset }) => ({
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
        for (const { viewport, offset } of this._viewports) {
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
            this._viewports.push({ viewport, offset: [this._current_offset, 0] });
            this._current_offset += viewport.width;
        }

        this.update();
    }

    /**
     *
     */
    update(): void {
        const need_to_resize = this._computeSurfaceSize();

        if (this.#core.isConfigured() && this._isValid()) {
            if (need_to_resize) {
                this.#core.resize({ size: this._dimensions });
            }
            this.#core.setViewports({ viewports: this.config });
        }
    }

    /**
     *
     */
    private _isValid(): boolean {
        return this._viewports.every(({ viewport }) => viewport.isValid());
    }

    /**
     *
     */
    private _computeSurfaceSize(): boolean {
        const next_multiple_of_8 = (n: number) =>
            Math.floor(n) + (Math.floor(n) % 8 === 0 ? 0 : 8 - (Math.floor(n) % 8));

        let width = 0;
        let height = 0;

        for (const { viewport } of this._viewports) {
            width += viewport.width;
            height = Math.max(height, viewport.height);
        }

        const new_dimensions: Vec2 = [next_multiple_of_8(width), next_multiple_of_8(height)];

        const need_to_resize = new_dimensions[0] != this._dimensions[0] || new_dimensions[1] != this.dimensions[1];

        this._dimensions = new_dimensions;

        return need_to_resize;
    }
}

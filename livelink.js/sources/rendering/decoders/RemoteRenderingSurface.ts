//------------------------------------------------------------------------------
import type { CodecType, Vec2i, Vec2ui16, ViewportConfig } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Livelink } from "../../Livelink";
import { Viewport } from "../Viewport";
import { RenderingSurfaceBase } from "../surfaces/RenderingSurfaceBase";
import { DecodedFrameConsumer } from "./DecodedFrameConsumer";
import { FrameMetaData } from "./FrameMetaData";

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
 * The surface is also responsible of decoding the encoded frame returned by the
 * renderer and spliting the decoded frame into areas corresponding to their
 * respective viewports.
 *
 * @category Streaming
 *
 */
export class RemoteRenderingSurface implements DecodedFrameConsumer {
    /**
     * Owning Livelink instance.
     */
    #core: Livelink;

    /**
     * Reference counted rendering surfaces.
     */
    #surfaces: Array<RenderingSurfaceBase> = [];

    /**
     * Surface actual dimensions.
     */
    #dimensions: Vec2ui16 = [0, 0];

    /**
     * Because of the way the encoder works, pixels may be grouped in macroblocks,
     * to avoid artifacts the surface dimensions must be a multiple of a power of 2.
     * This multiple value depends on the encoder used.
     */
    #size_multiple: Vec2ui16 = [32, 32];

    /**
     * Surface dimensions in pixels rounded up to the next multiple of 8.
     */
    get dimensions(): Vec2ui16 {
        return this.#dimensions;
    }
    get width(): number {
        return this.#dimensions[0];
    }
    get height(): number {
        return this.#dimensions[1];
    }

    /**
     * Registered viewports.
     */
    get viewports(): Array<Viewport> {
        const result: Array<Viewport> = [];
        for (const surface of this.#surfaces) {
            result.push(...surface.viewports);
        }
        return result;
    }

    /**
     * Config for all registered viewports.
     */
    get #config(): Array<ViewportConfig> {
        const result: Array<ViewportConfig & { z_index: number }> = [];
        for (const surface of this.#surfaces) {
            result.push(...surface._getViewportConfigs({ width: this.width, height: this.height }));
        }
        return result.sort((a, b) => a.z_index - b.z_index);
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
    consumeDecodedFrame({
        decoded_frame,
        meta_data,
    }: {
        decoded_frame: VideoFrame | OffscreenCanvas;
        meta_data: FrameMetaData;
    }): void {
        for (const surface of this.#surfaces) {
            surface.drawFrame({ frame: decoded_frame, meta_data });
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
            viewport.rendering_surface.addViewport({ viewport });

            if (this.#surfaces.indexOf(viewport.rendering_surface) === -1) {
                console.debug("Adding a new surface", viewport.rendering_surface);
                viewport.rendering_surface.addEventListener("on-resized", this.#onViewportResized);
                this.#surfaces.push(viewport.rendering_surface);
            }
        }

        this.#onViewportResized();
    }

    /**
     * Detach a viewport from the surface
     */
    removeViewport({ viewport }: { viewport: Viewport }): void {
        const index = this.#surfaces.indexOf(viewport.rendering_surface);
        if (index === -1) {
            throw new Error("Viewport without registered surface");
        }

        const surface = this.#surfaces[index];
        surface.removeViewport({ viewport });

        viewport.release();

        if (surface.viewports.length === 0) {
            surface.removeEventListener("on-resized", this.#onViewportResized);
            surface.release();
            this.#surfaces.splice(index, 1);
        }

        this.#onViewportResized();
    }

    /**
     *
     */
    init(): void {
        this.#onViewportResized();
    }

    /**
     *
     */
    computeRemoteCanvasSize({ codec }: { codec: CodecType }): Vec2ui16 {
        if (codec === "h265") {
            const HEVC_MACROBLOCK_SIZE: Vec2i = [64, 64] as const;
            this.#size_multiple = HEVC_MACROBLOCK_SIZE;
            this.#computeSurfaceSize();
        }

        return this.#dimensions;
    }

    /**
     *
     */
    release(): void {
        for (const surface of this.#surfaces) {
            surface.release();
        }
        this.#surfaces.length = 0;
    }

    /**
     *
     */
    #isValid(): boolean {
        return this.#surfaces.every(s => s.isValid());
    }

    /**
     *
     */
    #onViewportResized = (): void => {
        const need_to_resize = this.#computeSurfaceSize();

        if (this.#core.isConfigured() && this.#isValid()) {
            if (need_to_resize) {
                console.debug("Surface resized", this.#dimensions);
                this.#core._resize({ size: this.#dimensions });
            }
            console.debug("Viewports reconfigured", this.#config);
            this.#core._setViewports({ viewport_configs: this.#config });
        }
    };

    #next_multiple = (n: number, multiple: number): number => {
        return Math.floor(n) + (Math.floor(n) % multiple === 0 ? 0 : multiple - (Math.floor(n) % multiple));
    };

    /**
     *
     */
    #computeSurfaceSize(): boolean {
        const { offset, width, height } = this.#computeBoundingRect();
        this.#computeViewportsOffsets(offset);

        const new_dimensions: Vec2i = [
            this.#next_multiple(width, this.#size_multiple[0]),
            this.#next_multiple(height, this.#size_multiple[1]),
        ];

        const need_to_resize = new_dimensions[0] != this.#dimensions[0] || new_dimensions[1] != this.dimensions[1];

        this.#dimensions = new_dimensions;

        return need_to_resize;
    }

    /**
     *
     */
    #computeBoundingRect(): { offset: Vec2i; width: number; height: number } {
        const min: Vec2i = [Number.MAX_VALUE, Number.MAX_VALUE];
        const max: Vec2i = [0, 0];

        for (const surface of this.#surfaces) {
            const clientRect = surface.getBoundingRect();
            min[0] = Math.min(min[0], clientRect.left);
            min[1] = Math.min(min[1], clientRect.top);
            max[0] = Math.max(max[0], clientRect.right);
            max[1] = Math.max(max[1], clientRect.bottom);
        }

        const width = max[0] - min[0];
        const height = max[1] - min[1];
        return { offset: min, width, height: height };
    }

    /**
     *
     */
    #computeViewportsOffsets(client_rect_offset: Vec2i): void {
        for (const surface of this.#surfaces) {
            const clientRect = surface.getBoundingRect();
            surface.offset[0] = clientRect.left - client_rect_offset[0];
            surface.offset[1] = clientRect.top - client_rect_offset[1];
        }
    }
}

//------------------------------------------------------------------------------
import { Vec2i, Commands } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Rect } from "./Rect";
import { Viewport } from "../Viewport";
import { FrameMetaData } from "../decoders/FrameMetaData";
import { RenderingSurfaceEvents } from "./RenderingSurfaceEvents";
import { TypedEventTarget } from "../../TypedEventTarget";

/**
 * Abstract class for rendering surfaces.
 *
 * A rendering surface represents the final destination of the rendered frame.
 *
 * It is usually backed by an HTML Canvas or an OffscreenCanvas.
 *
 * It can be split into multiple viewports, each with its own camera and render target.
 * The rendering surface if responsible for holding the viewports and their configurations.
 *
 * It is finally responsible for drawing the portions of the final frame to its backing element.
 *
 * @category Rendering
 */
export abstract class RenderingSurfaceBase extends TypedEventTarget<RenderingSurfaceEvents> {
    /**
     * List of viewports bound to the current surface.
     */
    readonly viewports: Array<Viewport> = [];

    /**
     *
     */
    #last_draw_data: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData } | null = null;

    /**
     * Offset of the surface relative to the remote rendering surface.
     */
    offset: Vec2i = [0, 0];

    /**
     * Width of the surface.
     */
    abstract get width(): number;

    /**
     * Height of the surface.
     */
    abstract get height(): number;

    /**
     * Returns the bounding rectangle of the surface.
     */
    abstract getBoundingRect(): Rect;

    /**
     * Draws the portions of the frame associated with the viewports to the backing element.
     * Keeps a reference to the last frame drawn.
     *
     * @param params
     * @param params.frame - The frame to draw.
     * @param params.meta_data - The metadata associated with the frame.
     */
    drawFrame({ frame, meta_data }: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData }): void {
        this.#last_draw_data = { frame, meta_data };
        this._drawFrame({ frame, meta_data });
    }

    /**
     * Redraws the last frame.
     */
    redrawLastFrame(): void {
        if (this.#last_draw_data !== null) {
            this._drawFrame(this.#last_draw_data);
        }
    }

    /**
     * @internal
     *
     * Draws the portions of the frame associated with the viewports to the backing element.
     *
     * @param params
     * @param params.frame - The frame to draw.
     * @param params.meta_data - The metadata associated with the frame.
     */
    abstract _drawFrame({ frame, meta_data }: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData }): void;

    /**
     * Adds a viewport to the current surface.
     *
     * Note that the viewport knows which section of the surface it should draw to using
     * its {@link Viewport.relative_rect} property.
     *
     * @param params
     * @param params.viewport - The viewport to add.
     */
    addViewport({ viewport }: { viewport: Viewport }): void {
        this.viewports.push(viewport);
    }

    /**
     * Removes a viewport from the current surface.
     *
     * @param params
     * @param params.viewport - The viewport to remove.
     */
    removeViewport({ viewport }: { viewport: Viewport }): void {
        const index = this.viewports.indexOf(viewport);
        if (index !== -1) {
            this.viewports.splice(index, 1);
        }
    }

    /**
     * Releases the resources associated with the current surface.
     */
    release(): void {
        for (const viewport of this.viewports) {
            viewport.release();
        }
        this.viewports.length = 0;
    }

    /**
     * Returns whether the current surface is valid.
     */
    isValid(): boolean {
        return this.viewports.length > 0 && this.viewports.every(v => v.isValid());
    }

    /**
     * @internal
     * Returns the viewport configurations for the current surface.
     */
    _getViewportConfigs({
        width,
        height,
    }: {
        width: number;
        height: number;
    }): Array<Commands.ViewportConfig & { z_index: number }> {
        if (!this.isValid()) {
            throw new Error("Invalid config");
        }

        return this.viewports.map(viewport => ({
            camera_rtid: viewport.camera_projection!.camera_entity.rtid,
            left: (this.offset[0] + viewport.relative_rect.left * this.width) / width,
            top: (this.offset[1] + viewport.relative_rect.top * this.height) / height,
            width: viewport.width / width,
            height: viewport.height / height,
            render_target_index: viewport.render_target_index,
            z_index: viewport.z_index,
        }));
    }
}

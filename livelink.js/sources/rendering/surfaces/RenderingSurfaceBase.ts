//------------------------------------------------------------------------------
import type { Commands, Vec2 } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Rect, RelativeRect } from "./Rect";
import { Viewport } from "../camera/Viewport";
import { RenderingSurfaceEvents, RenderingSurfaceResizedEvent } from "./RenderingSurfaceEvents";
import { TypedEventTarget } from "../../TypedEventTarget";
import { DecodedFrame } from "../streaming/EncodedFrameConsumer";

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
 * @category Rendering Surfaces
 */
export abstract class RenderingSurfaceBase extends TypedEventTarget<RenderingSurfaceEvents> {
    /**
     * List of viewports bound to the current surface.
     */
    readonly viewports: Array<Viewport> = [];

    /**
     *
     */
    #last_draw_data: DecodedFrame | null = null;

    /**
     * Normalized dimensions and offset of the surface relative to the remote rendering surface.
     */
    relative_rect: RelativeRect = new RelativeRect({ left: 0, top: 0, width: 1, height: 1 });

    /**
     * Scale of the surface.
     */
    protected _scale: number = 1.0;

    /**
     * Scale of the surface.
     */
    get scale(): number {
        return this._scale;
    }

    /**
     * Set scale of the surface.
     */
    set scale(scale: number) {
        if (scale <= 0) {
            throw new Error(`Scale must be a positive number, got ${scale}`);
        }
        if (this._scale === scale) {
            return;
        }
        this._scale = scale;
        this._onScaleUpdated();
        this._dispatchEvent(new RenderingSurfaceResizedEvent());
    }

    /**
     * Dimensions of the surface.
     */
    get dimensions(): Vec2 {
        return [this.width, this.height];
    }

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
     * Releases the resources associated with the current surface.
     */
    release(): void {
        this.#last_draw_data = null;
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
     * Draws the portions of the frame associated with the viewports to the backing element.
     * Keeps a reference to the last frame drawn.
     *
     * @param params
     * @param params.decoded_frame - The frame to draw.
     */
    drawFrame({ decoded_frame }: { decoded_frame: DecodedFrame }): void {
        this.#last_draw_data = decoded_frame;
        this._drawFrame({ decoded_frame });
    }

    /**
     * Redraws the last frame.
     */
    redrawLastFrame(): void {
        if (this.#last_draw_data !== null) {
            this._drawFrame({ decoded_frame: this.#last_draw_data });
        }
    }

    /**
     * Adds a viewport to the current surface.
     *
     * Note that the viewport knows which section of the surface it should draw to using
     * its {@link Viewport.relative_rect} property.
     *
     * @param params
     * @param params.viewport - The viewport to add.
     *
     * @internal
     */
    _addViewport({ viewport }: { viewport: Viewport }): void {
        this.viewports.push(viewport);
    }

    /**
     * Removes a viewport from the current surface.
     *
     * @param params
     * @param params.viewport - The viewport to remove.
     *
     * @internal
     */
    _removeViewport({ viewport }: { viewport: Viewport }): void {
        const index = this.viewports.indexOf(viewport);
        if (index !== -1) {
            this.viewports.splice(index, 1);
        }
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

        const offset_in_remote_surface = [this.relative_rect.left * width, this.relative_rect.top * height];

        return this.viewports.map(viewport => ({
            camera_rtid: viewport.camera_projection!.camera_entity.rtid,
            left: (offset_in_remote_surface[0] + viewport.relative_rect.left * this.width) / width,
            top: (offset_in_remote_surface[1] + viewport.relative_rect.top * this.height) / height,
            width: viewport.width / width,
            height: viewport.height / height,
            render_target_index: viewport.render_target_index,
            z_index: viewport.z_index,
        }));
    }

    /**
     * @internal
     *
     * Called when the scale of the surface is updated.
     */
    protected abstract _onScaleUpdated(): void;

    /**
     * @internal
     *
     * Draws the portions of the frame associated with the viewports to the backing element.
     *
     * @param params
     * @param params.decoded_frame - The frame to draw.
     */
    protected abstract _drawFrame({ decoded_frame }: { decoded_frame: DecodedFrame }): void;
}

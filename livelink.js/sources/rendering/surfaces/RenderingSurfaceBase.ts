//------------------------------------------------------------------------------
import { Vec2i, ViewportConfig } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Rect } from "./Rect";
import { Viewport } from "../Viewport";
import { FrameMetaData } from "../decoders/FrameMetaData";

/**
 * @category Rendering
 */
export abstract class RenderingSurfaceBase extends EventTarget {
    /**
     * List of viewports bound to the current surface.
     */
    readonly viewports: Array<Viewport> = [];

    /**
     * Offset of the surface relative to the remote rendering surface.
     */
    offset: Vec2i = [0, 0];

    /**
     *
     */
    abstract get width(): number;

    /**
     *
     */
    abstract get height(): number;

    /**
     *
     */
    getViewportConfigs(width: number, height: number): Array<ViewportConfig & { z_index: number }> {
        if (!this.isValid()) {
            throw new Error("Invalid config");
        }

        return this.viewports.map(viewport => ({
            camera_rtid: viewport.camera_projection!.camera_entity.rtid!,
            left: (this.offset[0] + viewport.relative_rect.left * this.width) / width,
            top: (this.offset[1] + viewport.relative_rect.top * this.height) / height,
            width: viewport.width / width,
            height: viewport.height / height,
            render_target_index: viewport.render_target_index,
            z_index: viewport.z_index,
        }));
    }

    /**
     *
     */
    addViewport({ viewport }: { viewport: Viewport }): void {
        this.viewports.push(viewport);
    }

    /**
     *
     */
    removeViewport({ viewport }: { viewport: Viewport }): void {
        const index = this.viewports.indexOf(viewport);
        if (index !== -1) {
            this.viewports.splice(index, 1);
        }
    }

    /**
     *
     */
    release(): void {
        for (const viewport of this.viewports) {
            viewport.release();
        }
        this.viewports.length = 0;
    }

    /**
     *
     */
    isValid(): boolean {
        return this.viewports.length > 0 && this.viewports.every(v => v.isValid());
    }

    /**
     *
     */
    abstract getBoundingRect(): Rect;

    /**
     *
     */
    abstract drawFrame(frame: { frame: VideoFrame | OffscreenCanvas; meta_data: FrameMetaData }): void;
}

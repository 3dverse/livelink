import { Vec2i, ViewportConfig } from "@3dverse/livelink.core";
import { Viewport } from "../Viewport";
import { CurrentFrameMetaData } from "../decoders/CurrentFrameMetaData";
import { Rect } from "./Rect";

/**
 *
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
    getViewportConfigs(width: number, height: number): Array<ViewportConfig> {
        if (!this.isValid()) {
            throw new Error("Invalid config");
        }

        return this.viewports.map(viewport => ({
            camera_rtid: viewport.camera!.rtid!,
            left: (this.offset[0] + viewport.rect.left * this.width) / width,
            top: (this.offset[1] + viewport.rect.top * this.height) / height,
            width: viewport.width / width,
            height: viewport.height / height,
            render_target_index: viewport.render_target_index,
        }));
    }

    /**
     *
     */
    addViewport({ viewport }: { viewport: Viewport }) {
        this.viewports.push(viewport);
    }

    /**
     *
     */
    removeViewport({ viewport }: { viewport: Viewport }) {
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
    abstract drawFrame(frame: { frame: VideoFrame | OffscreenCanvas; meta_data: CurrentFrameMetaData }): void;
}

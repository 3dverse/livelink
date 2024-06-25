import type { HighlightMode, Vec2, Vec3 } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";

import { Livelink } from "./Livelink";
import { Camera } from "./Camera";
import { Entity } from "./Entity";
import { Rect, RenderingSurfaceBase } from "./surfaces/RenderingSurfaceBase";
import { RenderingSurface } from "./surfaces/RenderingSurface";

/**
 *
 */
const DEFAULT_RECT: Rect = {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
    width: 1,
    height: 1,
} as const;

/**
 *
 */
export class Viewport extends EventTarget {
    /**
     * The Livelink core used to send commands.
     */
    #core: Livelink;

    /**
     *
     */
    #rendering_surface: RenderingSurfaceBase;

    /**
     *
     */
    #camera: Camera | null = null;

    /**
     *
     */
    readonly rect: Rect;

    /**
     *
     */
    get rendering_surface() {
        return this.#rendering_surface;
    }

    /**
     *
     */
    get camera(): Camera | null {
        return this.#camera;
    }

    /**
     *
     */
    get width(): number {
        return this.rect.width * this.rendering_surface.width;
    }
    get height(): number {
        return this.rect.height * this.rendering_surface.height;
    }
    get aspect_ratio(): number {
        return this.rect.height > 0 ? this.rect.width / this.rect.height : 1;
    }

    /**
     *
     */
    set camera(c: Camera) {
        this.#camera = c;
        c.viewport = this;
        this.#core.refreshViewports();
    }

    /**
     * @param canvas_element DOM Element or id of the canvas on which to display the final composited frame
     *
     * @throws {InvalidCanvasId} Thrown when the provided id doesn't refer to a canvas element.
     */
    constructor(core: Livelink, rendering_surface: RenderingSurfaceBase, rect: Rect = DEFAULT_RECT) {
        super();
        this.#core = core;
        this.#rendering_surface = rendering_surface;
        this.rect = rect;
    }

    /**
     *
     */
    isValid(): boolean {
        return this.#camera !== null;
    }

    /**
     *
     */
    release(): void {
        this.deactivatePicking();
    }

    /**
     *
     */
    activatePicking(): void {
        const canvas = (this.rendering_surface as RenderingSurface).canvas;
        canvas?.addEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    deactivatePicking(): void {
        const canvas = (this.rendering_surface as RenderingSurface).canvas;
        canvas?.removeEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    #onCanvasClicked = async (e: MouseEvent) => {
        const canvas = (this.rendering_surface as RenderingSurface).canvas;
        const pos: Vec2 = [
            e.offsetX / (canvas.clientWidth - canvas.clientLeft),
            e.offsetY / (canvas.clientHeight - canvas.clientTop),
        ];

        const res = await this.castScreenSpaceRay({
            pos,
            mode: LivelinkCoreModule.Enums.HighlightMode.HighlightAndDiscardOldSelection,
        });

        this.dispatchEvent(new CustomEvent("on-entity-picked", { detail: res }));
    };

    /**
     *
     */
    async castScreenSpaceRay({
        pos,
        mode = LivelinkCoreModule.Enums.HighlightMode.None,
    }: {
        pos: Vec2;
        mode: HighlightMode;
    }): Promise<{ entity: Entity; ws_position: Vec3; ws_normal: Vec3 } | null> {
        if (!this.#camera || !this.#camera.rtid) {
            return null;
        }

        const res = await this.#core._castScreenSpaceRay({
            screenSpaceRayQuery: {
                camera_rtid: this.#camera.rtid,
                pos,
                mode,
            },
        });

        if (res.entity_rtid === null) {
            return null;
        }

        const entity = await this.#core.scene.getEntity({ entity_rtid: res.entity_rtid });
        if (entity === null) {
            return null;
        }

        return { entity, ws_position: res.position, ws_normal: res.normal };
    }
}

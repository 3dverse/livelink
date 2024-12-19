import type { HighlightMode, Vec2, Vec3 } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";

import { Livelink } from "./Livelink";
import { Camera } from "./Camera";
import { RenderingSurfaceBase } from "./surfaces/RenderingSurfaceBase";
import { RelativeRect } from "./surfaces/Rect";
import { vec3 } from "gl-matrix";
import { OverlayInterface } from "./surfaces/OverlayInterface";
import { CurrentFrameMetaData } from "./decoders/CurrentFrameMetaData";
import { Entity } from "./Entity";

/**
 * @category Rendering
 */
export class Viewport extends EventTarget {
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP
    /**
     * @deprecated
     */
    TO_REMOVE__markViewportAsReady() {
        this.TO_REMOVE__ready = true;
        this.#core.TO_REMOVE__startIfReady();
    }
    /**
     * @deprecated
     */
    TO_REMOVE__ready: boolean = false;
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP

    /**
     * The Livelink core used to send commands.
     */
    #core: Livelink;

    /**
     * The rendering surface on which the viewport is displayed.
     */
    #rendering_surface: RenderingSurfaceBase;

    /**
     * The camera used to render the scene.
     */
    #camera: Camera | null = null;

    /**
     * The index of the render target that is rendered on the viewport.
     */
    render_target_index: number = -1;

    /**
     * Overlays that are rendered on top of the viewport.
     */
    #overlays: Array<OverlayInterface> = [];

    /**
     * The z-index of the viewport.
     */
    #z_index: number = 0;

    /**
     * The relative position and size of the viewport in relation to the rendering surface.
     */
    #rect: RelativeRect;

    /**
     * The DOM element used for picking.
     */
    #element: HTMLElement | null = null;

    /**
     * The rendering surface on which the viewport is displayed.
     */
    get rendering_surface() {
        return this.#rendering_surface;
    }

    /**
     * The camera used to render the scene.
     */
    get camera(): Camera | null {
        return this.#camera;
    }

    /**
     * The width and height of the viewport in pixels.
     */
    get width(): number {
        return this.#rect.width * this.rendering_surface.width;
    }
    get height(): number {
        return this.#rect.height * this.rendering_surface.height;
    }
    get offset(): Vec2 {
        return [this.#rect.left * this.rendering_surface.width, this.#rect.top * this.rendering_surface.height];
    }
    get aspect_ratio(): number {
        return this.height > 0 ? this.width / this.height : 1;
    }
    get z_index(): number {
        return this.#z_index;
    }
    get rect(): RelativeRect {
        return this.#rect;
    }

    /**
     *
     */
    set z_index(z_index: number) {
        this.#z_index = z_index;
        this.#core.refreshViewports();
    }

    /**
     *
     */
    set rect(rect: RelativeRect) {
        this.#rect = rect;
        this.#core.refreshViewports();
    }

    /**
     *
     */
    set camera(camera: Camera) {
        this.#camera = camera;
        this.#core.refreshViewports();
    }

    /**
     * @param canvas_element DOM Element or id of the canvas on which to display the final composited frame
     *
     * @throws {InvalidCanvasId} Thrown when the provided id doesn't refer to a canvas element.
     */
    constructor(
        core: Livelink,
        rendering_surface: RenderingSurfaceBase,
        options?: { rect?: RelativeRect; render_target_index?: number; z_index?: number },
    ) {
        super();
        this.#core = core;
        this.#rendering_surface = rendering_surface;
        this.#rect = new RelativeRect(options?.rect ?? { left: 0, top: 0, width: 1, height: 1 });
        this.render_target_index = options?.render_target_index ?? -1;
        this.#z_index = options?.z_index ?? 0;
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
    activatePicking({ element }: { element: HTMLElement }): void {
        this.#element = element;
        this.#element.addEventListener("click", this.#onCanvasClicked);
    }

    /**
     *
     */
    deactivatePicking(): void {
        this.#element?.removeEventListener("click", this.#onCanvasClicked);
        this.#element = null;
    }

    /**
     *
     */
    #onCanvasClicked = async (e: MouseEvent) => {
        e.stopPropagation();

        const cursorData = this.#core.session.current_client?.cursor_data;
        if (!cursorData) {
            return;
        }

        const entity = await this.#core.scene.getEntity({ entity_rtid: cursorData.hovered_entity_rtid });
        const detail = entity
            ? { entity, ws_position: cursorData.hovered_ws_position, ws_normal: cursorData.hovered_ws_normal }
            : null;
        this.dispatchEvent(new CustomEvent("on-entity-picked", { detail }));
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
        if (!this.#camera || !this.#camera.camera_entity.rtid) {
            return null;
        }

        const res = await this.#core._castScreenSpaceRay({
            screenSpaceRayQuery: {
                camera_rtid: this.#camera.camera_entity.rtid,
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

    /**
     *
     */
    projectWorldToScreen({
        world_position,
        out_screen_position = vec3.create() as Vec3,
    }: {
        world_position: Vec3;
        out_screen_position?: Vec3;
    }) {
        if (!this.#camera) {
            throw new Error("No camera set on viewport");
        }

        const clip_position = this.#camera.projectWorldToClip({
            world_position,
            out_clip_position: out_screen_position,
        });

        const screen_position = clip_position;
        screen_position[0] = (clip_position[0] + 1) * this.width * 0.5;
        screen_position[1] = (-clip_position[1] + 1) * this.height * 0.5;

        return screen_position;
    }

    /**
     *
     */
    addOverlay({ overlay }: { overlay: OverlayInterface }): void {
        if (this.#overlays.includes(overlay)) {
            console.warn("Attempting to add an overlay that is already present", overlay);
            return;
        }
        this.#overlays.push(overlay);
    }

    /**
     *
     */
    removeOverlay({ overlay }: { overlay: OverlayInterface }): void {
        overlay.release();

        const index = this.#overlays.indexOf(overlay);
        if (index === -1) {
            console.warn("Attempting to remove an overlay that is not present", overlay);
            return;
        }

        this.#overlays.splice(index, 1);
    }

    /**
     *
     */
    drawOverlays({ meta_data }: { meta_data: CurrentFrameMetaData }): OffscreenCanvas | null {
        let blendedFrame: OffscreenCanvas | null = null;
        for (const overlay of this.#overlays) {
            const overlayFrame = overlay.draw({ meta_data, output_canvas: blendedFrame });

            if (!blendedFrame) {
                blendedFrame = overlayFrame;
            }
        }

        return blendedFrame;
    }

    /**
     * @internal
     */
    onResize(): void {
        this.camera?.updateLens();
        for (const overlay of this.#overlays) {
            overlay.resize({ width: this.width, height: this.height });
        }
    }
}

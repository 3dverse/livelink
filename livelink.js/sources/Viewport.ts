import type { HighlightMode, Vec2, Vec3 } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";

import { Livelink } from "./Livelink";
import { Camera } from "./Camera";
import { Entity } from "./Entity";
import { RenderingSurfaceBase } from "./surfaces/RenderingSurfaceBase";
import { RelativeRect } from "./surfaces/Rect";
import { RenderingSurface } from "./surfaces/RenderingSurface";
import { vec2, vec3 } from "gl-matrix";
import { OverlayInterface } from "./surfaces/OverlayInterface";
import { CurrentFrameMetaData } from "./decoders/CurrentFrameMetaData";

/**
 * @category Rendering
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
    render_target_index: number = -1;

    /**
     *
     */
    #overlays: Array<OverlayInterface> = [];

    /**
     *
     */
    readonly rect: RelativeRect;

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
    get offset(): Vec2 {
        return [this.rect.left * this.rendering_surface.width, this.rect.top * this.rendering_surface.height];
    }
    get aspect_ratio(): number {
        return this.height > 0 ? this.width / this.height : 1;
    }

    /**
     *
     */
    set camera(c: Camera) {
        if (this.#camera) {
            this.#camera.onDetach?.();
        }
        this.#camera = c;
        c.viewport = this;
        c.onAttach?.();
        this.#core.refreshViewports();
    }

    /**
     *
     */
    ready: boolean = false;

    /**
     * @experimental
     */
    markViewportAsReady() {
        this.ready = true;
        this.#core.startStreamingIfReady();
    }

    /**
     * @param canvas_element DOM Element or id of the canvas on which to display the final composited frame
     *
     * @throws {InvalidCanvasId} Thrown when the provided id doesn't refer to a canvas element.
     */
    constructor(
        core: Livelink,
        rendering_surface: RenderingSurfaceBase,
        options?: { rect?: RelativeRect; render_target_index?: number },
    ) {
        super();
        this.#core = core;
        this.#rendering_surface = rendering_surface;
        this.rect = new RelativeRect(options?.rect ?? { left: 0, top: 0, width: 1, height: 1 });
        this.render_target_index = options?.render_target_index ?? -1;
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
     *
     */
    get overlays(): readonly OverlayInterface[] {
        return Object.freeze(Array.from(this.#overlays));
    }

    /**
     *
     */
    onResize(): void {
        this.camera?.updateLens();
        for (const overlay of this.#overlays) {
            overlay.resize({ width: this.width, height: this.height });
        }
    }
}

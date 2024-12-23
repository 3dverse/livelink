//------------------------------------------------------------------------------
import type { HighlightMode, Vec2, Vec3 } from "@3dverse/livelink.core";
import { LivelinkCoreModule } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import { Livelink } from "../Livelink";
import { Entity } from "../scene/Entity";
import { RelativeRect } from "./surfaces/Rect";
import { CameraProjection } from "./CameraProjection";
import { OverlayInterface } from "./surfaces/OverlayInterface";
import { RenderingSurfaceBase } from "./surfaces/RenderingSurfaceBase";

/**
 * A viewport is a rendering area on a {@link RenderingSurfaceBase} that is associated with a
 * {@link CameraProjection}.
 *
 * It can have overlays that are rendered on top of the viewport. See {@link OverlayInterface}.
 *
 * Viewports can overlap each other, in which case the one with the highest z-index is rendered on top.
 *
 * @category Rendering
 */
export class Viewport extends EventTarget {
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP
    /**
     * @internal
     * @deprecated
     */
    #TO_REMOVE__markViewportAsReady(): void {
        this.TO_REMOVE__ready = true;
        this.#core.TO_REMOVE__startIfReady();
    }
    /**
     * @internal
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
     * The camera projection used to render the scene.
     */
    #camera_projection: CameraProjection | null = null;

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
    #relative_rect: RelativeRect;

    /**
     * The DOM element used for picking.
     */
    #dom_element: HTMLElement | null = null;

    /**
     * The index of the render target that is rendered on the viewport.
     * -1 means the default render target.
     */
    #render_target_index: number = -1;

    /**
     * The rendering surface on which the viewport is displayed.
     */
    get rendering_surface(): RenderingSurfaceBase {
        return this.#rendering_surface;
    }

    /**
     * The camera projection used to render the scene.
     */
    get camera_projection(): CameraProjection | null {
        return this.#camera_projection;
    }

    /**
     * The width of the viewport in pixels.
     */
    get width(): number {
        return this.#relative_rect.width * this.rendering_surface.width;
    }

    /**
     * The height of the viewport in pixels.
     */
    get height(): number {
        return this.#relative_rect.height * this.rendering_surface.height;
    }

    /**
     * The offset of the viewport in pixels.
     */
    get offset(): Vec2 {
        return [
            this.#relative_rect.left * this.rendering_surface.width,
            this.#relative_rect.top * this.rendering_surface.height,
        ];
    }

    /**
     * The aspect ratio of the viewport.
     */
    get aspect_ratio(): number {
        return this.height > 0 ? this.width / this.height : 1;
    }

    /**
     * The z-index of the viewport.
     */
    get z_index(): number {
        return this.#z_index;
    }

    /**
     * The index of the render target that is rendered on the viewport.
     */
    get render_target_index(): number {
        return this.#render_target_index;
    }

    /**
     * The relative position and size of the viewport in relation to the rendering surface.
     */
    get relative_rect(): RelativeRect {
        return this.#relative_rect;
    }

    /**
     * Sets the z-index of the viewport.
     */
    set z_index(z_index: number) {
        this.#z_index = z_index;
        this.#core._refreshViewports();
    }

    /**
     * Sets the relative position and size of the viewport in relation to the rendering surface.
     */
    set relative_rect(rect: RelativeRect) {
        this.#relative_rect = rect;
        this.#core._refreshViewports();
    }

    /**
     * Sets the camera projection used to render the scene.
     */
    set camera_projection(camera_projection: CameraProjection) {
        this.#camera_projection = camera_projection;
        this.#core._refreshViewports();
        this.#TO_REMOVE__markViewportAsReady();
    }

    /**
     * The index of the render target that is rendered on the viewport.
     *
     * -1 means the default render target as defined by the render graph assigned to the camera the viewport is using.
     */
    set render_target_index(render_target_index: number) {
        this.#render_target_index = render_target_index;
        this.#core._refreshViewports();
    }

    /**
     * Creates a new viewport.
     *
     * @param params
     * @param params.core - The Livelink core used to send commands.
     * @param params.rendering_surface - The rendering surface on which the viewport is displayed.
     * @param params.options - The options for the viewport.
     * @param params.options.rect - The relative position and size of the viewport in relation to the rendering surface.
     * @param params.options.render_target_index - The index of the render target that is rendered on the viewport.
     * @param params.options.z_index - The z-index of the viewport.
     */
    constructor({
        core,
        rendering_surface,
        options,
    }: {
        core: Livelink;
        rendering_surface: RenderingSurfaceBase;
        options?: { rect?: RelativeRect; render_target_index?: number; z_index?: number };
    }) {
        super();
        this.#core = core;
        this.#rendering_surface = rendering_surface;
        this.#relative_rect = new RelativeRect(options?.rect ?? { left: 0, top: 0, width: 1, height: 1 });
        this.#render_target_index = options?.render_target_index ?? -1;
        this.#z_index = options?.z_index ?? 0;
    }

    /**
     * Returns whether the viewport is valid.
     *
     * A viewport is valid if a camera projection is set on it.
     */
    isValid(): boolean {
        return this.#camera_projection !== null;
    }

    /**
     * Releases the resources used by the viewport.
     */
    release(): void {
        this.deactivatePicking();
    }

    /**
     * Activates picking on the viewport.
     *
     * If picking is activated, the viewport will emit an `on-entity-picked` event when it is clicked.
     */
    activatePicking({ dom_element }: { dom_element: HTMLElement }): void {
        this.#dom_element = dom_element;
        this.#dom_element.addEventListener("click", this.#onCanvasClicked);
    }

    /**
     * Deactivates picking on the viewport.
     *
     * If picking is deactivated, the viewport will no longer emit an `on-entity-picked` event when it is clicked.
     */
    deactivatePicking(): void {
        this.#dom_element?.removeEventListener("click", this.#onCanvasClicked);
        this.#dom_element = null;
    }

    /**
     * Casts a screen space ray and returns the **first** entity and world space position and normal that the ray
     * intersects.
     * If no entity is intersected, null is returned.
     *
     * Note that transparent objects will be picked if they are in front of opaque objects even if their
     * opacity is set to 0.
     *
     * Do **not** use this method for picking objects using the mouse cursor.
     * Instead activate picking on the viewport using {@link activatePicking} and listen for the
     * `on-entity-picked` event.
     *
     * @param params
     * @param params.screen_position - The screen space position to cast the ray from.
     * @param params.mode - The highlight mode to use.
     *
     * @returns The entity and world space position and normal that the ray intersects, or null if no entity is
     * intersected.
     */
    async castScreenSpaceRay({
        screen_position,
        mode = LivelinkCoreModule.Enums.HighlightMode.None,
    }: {
        screen_position: Vec2;
        mode: HighlightMode;
    }): Promise<{ entity: Entity; world_position: Vec3; world_normal: Vec3 } | null> {
        if (!this.#camera_projection || !this.#camera_projection.camera_entity.rtid) {
            return null;
        }

        const res = await this.#core._castScreenSpaceRay({
            screenSpaceRayQuery: {
                camera_rtid: this.#camera_projection.camera_entity.rtid,
                pos: screen_position,
                mode,
            },
        });

        if (res.entity_rtid === null) {
            return null;
        }

        const entity = await this.#core.scene._getEntity({ entity_rtid: res.entity_rtid });
        if (entity === null) {
            return null;
        }

        return { entity, world_position: res.position, world_normal: res.normal };
    }

    /**
     * Projects a world space position to screen space.
     *
     * The position is projected using the camera projection set on the viewport.
     *
     * @param params
     * @param params.world_position - The position in world space to project.
     * @param params.out_screen_position - The output position in screen space.
     *
     * @returns The position in screen space.
     */
    projectWorldToScreen({
        world_position,
        out_screen_position = vec3.create() as Vec3,
    }: {
        world_position: Vec3;
        out_screen_position?: Vec3;
    }): Vec3 {
        if (!this.#camera_projection) {
            throw new Error("No camera set on viewport");
        }

        const clip_position = this.#camera_projection.projectWorldToClip({
            world_position,
            out_clip_position: out_screen_position,
        });

        const screen_position = clip_position;
        screen_position[0] = (clip_position[0] + 1) * this.width * 0.5;
        screen_position[1] = (-clip_position[1] + 1) * this.height * 0.5;

        return screen_position;
    }

    /**
     * Adds an overlay to the viewport.
     *
     * @param params
     * @param params.overlay - The overlay to add. Must not have been added to the viewport before.
     */
    addOverlay({ overlay }: { overlay: OverlayInterface }): void {
        if (this.#overlays.includes(overlay)) {
            console.warn("Attempting to add an overlay that is already present", overlay);
            return;
        }
        this.#overlays.push(overlay);
    }

    /**
     * Removes an overlay from the viewport.
     *
     * The overlay is released and should not be used after this method is called.
     *
     * @param params
     * @param params.overlay - The overlay to remove. Must have been added to the viewport before.
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
    drawOverlays(): OffscreenCanvas | null {
        let blendedFrame: OffscreenCanvas | null = null;
        for (const overlay of this.#overlays) {
            const overlayFrame = overlay.draw({ output_canvas: blendedFrame });

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
        this.camera_projection?.updateProjectionMatrix();
        for (const overlay of this.#overlays) {
            overlay.resize({ width: this.width, height: this.height });
        }
    }

    /**
     *
     */
    #onCanvasClicked = async (e: MouseEvent): Promise<void> => {
        e.stopPropagation();

        const cursorData = this.#core.session.current_client?.cursor_data;
        if (!cursorData) {
            return;
        }

        const entity = await this.#core.scene._getEntity({ entity_rtid: cursorData.hovered_entity_rtid });
        const detail = entity
            ? { entity, ws_position: cursorData.hovered_ws_position, ws_normal: cursorData.hovered_ws_normal }
            : null;
        this.dispatchEvent(new CustomEvent("on-entity-picked", { detail }));
    };
}

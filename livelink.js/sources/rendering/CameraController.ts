//------------------------------------------------------------------------------
import { Components } from "@3dverse/livelink.core";
import CameraControls, { Clock } from "@3dverse/livelink-camera-controls";

//------------------------------------------------------------------------------
import type { Entity } from "../scene/Entity";
import type { Viewport } from "./Viewport";

/**
 * A camera controller based on the `camera-controls` library.
 *
 * @category Rendering
 */
export class CameraController extends CameraControls {
    /**
     *
     */
    #camera_entity: Entity;

    /**
     *
     */
    #viewport: Viewport;

    /**
     *
     */
    #clock: Clock = new Clock();

    /**
     *
     */
    #update_interval: number = 0;

    /**
     *
     */
    constructor({
        camera_entity,
        viewport,
        activate = true,
    }: {
        camera_entity: Entity;
        viewport: Viewport;
        activate?: boolean;
    }) {
        super(
            camera_entity.local_transform as Components.LocalTransform,
            getLens(camera_entity),
            viewport.aspect_ratio,
            viewport.dom_element,
        );

        this.#camera_entity = camera_entity;
        this.#viewport = viewport;

        this.#viewport.is_camera_controlled_by_current_client = true;

        this.#initController();

        if (activate) {
            this.activate();
        }

        this.#viewport.rendering_surface.addEventListener("on-rendering-surface-resized", this.onViewportResize);
    }

    /**
     *
     */
    onViewportResize = (): void => {
        this.aspectRatio = this.#viewport.aspect_ratio;
    };

    /**
     *
     */
    release(): void {
        this.#viewport.is_camera_controlled_by_current_client = false;
        this.#viewport.rendering_surface.removeEventListener("on-rendering-surface-resized", this.onViewportResize);
        this.deactivate();
        this.dispose();
    }

    /**
     *
     */
    activate(): void {
        if (this.#update_interval !== 0) {
            return;
        }

        this.#update_interval = setInterval(() => {
            this.update(this.#clock.getDelta());
        }, 1000 / 60);
    }

    /**
     *
     */
    deactivate(): void {
        if (this.#update_interval === 0) {
            return;
        }

        clearInterval(this.#update_interval);
        this.#update_interval = 0;
    }

    /**
     *
     */
    #initController(): void {
        this.setOrbitPoint(0, 0, 0);
        this.setPosition(...this.#camera_entity.local_transform.position);
        this.addEventListener("update", this.#onCameraUpdate);
    }

    /**
     *
     */
    #onCameraUpdate = (): void => {
        this.position.toArray(this.#camera_entity.local_transform.position);
        this.orientation.toArray(this.#camera_entity.local_transform.orientation);
    };
}

/**
 *
 */
function getLens(camera_entity: Entity): Components.PerspectiveLens | Components.OrthographicLens {
    const lens = camera_entity.perspective_lens || camera_entity.orthographic_lens;
    if (!lens) {
        throw new Error("Camera entity must have a perspective or orthographic lens");
    }
    return lens;
}

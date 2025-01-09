//------------------------------------------------------------------------------
import { Components } from "@3dverse/livelink.core";
import CameraControls, { Clock } from "@3dverse/livelink-camera-controls";

//------------------------------------------------------------------------------
import { Entity } from "../scene/Entity";

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
        dom_element,
        activate = true,
    }: {
        camera_entity: Entity;
        dom_element: HTMLElement;
        activate?: boolean;
    }) {
        super(camera_entity.local_transform!, getLens(camera_entity), dom_element);

        this.#camera_entity = camera_entity;

        this.#initController();

        if (activate) {
            this.activate();
        }
    }

    /**
     *
     */
    release(): void {
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
        this.setPosition(...this.#camera_entity.local_transform!.position);
        this.addEventListener("update", this.#onCameraUpdate);
    }

    /**
     *
     */
    #onCameraUpdate = (): void => {
        this.position.toArray(this.#camera_entity.local_transform!.position);
        this.orientation.toArray(this.#camera_entity.local_transform!.orientation);
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

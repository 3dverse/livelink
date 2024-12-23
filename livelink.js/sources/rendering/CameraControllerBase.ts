import { Entity } from "../scene/Entity";

/**
 * Base class for camera controllers.
 *
 * @category Rendering
 */
export abstract class CameraControllerBase {
    /**
     *
     */
    protected readonly _camera_entity: Entity;

    /**
     *
     */
    #update_interval: number = 0;

    /**
     *
     */
    #update_frequency: number = 60;

    /**
     *
     */
    set update_frequency(value: number) {
        this.#update_frequency = value;
        if (this.#update_interval) {
            this.deactivate();
            this.activate();
        }
    }

    /**
     *
     */
    constructor({ camera_entity }: { camera_entity: Entity }) {
        this._camera_entity = camera_entity;
    }

    /**
     *
     */
    activate(): void {
        this.#update_interval = setInterval(() => {
            this.update();
        }, 1000 / this.#update_frequency);
    }

    /**
     *
     */
    deactivate(): void {
        if (this.#update_interval) {
            clearInterval(this.#update_interval);
            this.#update_interval = 0;
        }
    }

    /**
     *
     */
    abstract update(): void;

    /**
     *
     */
    abstract release(): void;
}

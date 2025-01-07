//------------------------------------------------------------------------------
import { CameraControllerBase, Entity } from "@3dverse/livelink";
import CameraControls, { Clock } from "@3dverse/livelink-camera-controls";

/**
 * A camera controller that uses the `camera-controls` library.
 *
 * @category Camera Controllers
 */
export class DefaultCameraController extends CameraControllerBase {
    /**
     *
     */
    readonly cameraControls: CameraControls;

    /**
     *
     */
    readonly clock: Clock = new Clock();

    /**
     *
     */
    constructor({ camera_entity, dom_element }: { camera_entity: Entity; dom_element: HTMLElement }) {
        super({ camera_entity });

        const lens = camera_entity.perspective_lens || camera_entity.orthographic_lens;
        if(!lens) {
            throw new Error("Camera entity must have a perspective or orthographic lens");
        }

        this.cameraControls = new CameraControls(camera_entity.local_transform!, lens, dom_element);
        this.#initController();
    }

    /**
     *
     */
    update(): void {
        this.cameraControls.update(this.clock.getDelta());
    }

    /**
     *
     */
    release(): void {
        this.cameraControls.dispose();
    }

    /**
     *
     */
    #initController() {
        this.cameraControls.setOrbitPoint(0, 0, 0);
        this.cameraControls.setPosition(...this._camera_entity.local_transform!.position);
        this.cameraControls.addEventListener("update", this.#onCameraUpdate);
    }

    /**
     *
     */
    #onCameraUpdate = () => {
        this.cameraControls.position.toArray(this._camera_entity.local_transform!.position);
        this.cameraControls.orientation.toArray(this._camera_entity.local_transform!.orientation);
    };
}

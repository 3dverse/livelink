//------------------------------------------------------------------------------
import { CameraControllerBase, Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import CameraControls from "camera-controls";

//------------------------------------------------------------------------------
import {
    PerspectiveCamera,
    Clock,
    Quaternion,
    Matrix4,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
    Box3,
    Sphere,
    Raycaster,
} from "three";

CameraControls.install({
    THREE: {
        Vector2,
        Vector3,
        Vector4,
        Quaternion,
        Matrix4,
        Spherical,
        Box3,
        Sphere,
        Raycaster,
    },
});

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
    readonly global_orientation = new Quaternion();

    /**
     *
     */
    constructor({ camera_entity, dom_element }: { camera_entity: Entity; dom_element: HTMLElement }) {
        super({ camera_entity });
        this.cameraControls = new CameraControls(this.#createCamera(), dom_element);
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
    #createCamera() {
        const camera = new PerspectiveCamera(
            this._camera_entity.perspective_lens!.fovy,
            this._camera_entity.perspective_lens!.aspectRatio,
            this._camera_entity.perspective_lens!.nearPlane,
            this._camera_entity.perspective_lens!.farPlane,
        );

        return camera;
    }

    /**
     *
     */
    #initController() {
        this.cameraControls.setOrbitPoint(0, 0, 0);
        this.cameraControls.setPosition(...this._camera_entity.local_transform!.position!);
        this.cameraControls.addEventListener("update", this.#onCameraUpdate);
    }

    /**
     *
     */
    #onCameraUpdate = () => {
        this.cameraControls.camera.getWorldQuaternion(this.global_orientation);
        this.cameraControls.camera.position.toArray(this._camera_entity.local_transform!.position);
        this.global_orientation.toArray(this._camera_entity.local_transform!.orientation);
    };
}

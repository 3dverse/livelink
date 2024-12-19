//------------------------------------------------------------------------------
import CameraControls from "camera-controls";
import { Entity, Quat } from "@3dverse/livelink";

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

import { CameraControllerInterface } from "../components/core/CameraController";

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

//------------------------------------------------------------------------------
export class DefaultCameraController implements CameraControllerInterface {
    /**
     *
     */
    readonly cameraControls: CameraControls;

    /**
     *
     */
    readonly camera_entity: Entity;

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
        this.camera_entity = camera_entity;
        this.cameraControls = new CameraControls(this.#createCamera(), dom_element);
        this.#initController();
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
            this.camera_entity.perspective_lens!.fovy,
            this.camera_entity.perspective_lens!.aspectRatio,
            this.camera_entity.perspective_lens!.nearPlane,
            this.camera_entity.perspective_lens!.farPlane,
        );

        return camera;
    }

    /**
     *
     */
    #initController() {
        // create camera controls
        this.cameraControls.setOrbitPoint(0, 0, 0);
        this.cameraControls.setPosition(...this.camera_entity.local_transform!.position!);
        this.cameraControls.addEventListener("update", this.#onCameraUpdate);
        requestAnimationFrame(this.#updateCamera);
    }

    /**
     *
     */
    #updateCamera = () => {
        const delta = this.clock.getDelta();
        this.cameraControls.update(delta);
        requestAnimationFrame(this.#updateCamera);
    };

    /**
     *
     */
    #onCameraUpdate = () => {
        this.cameraControls.camera.getWorldQuaternion(this.global_orientation);
        this.cameraControls.camera.position.toArray(this.camera_entity.local_transform!.position);
        this.global_orientation.toArray(this.camera_entity.local_transform!.orientation);
    };
}

//------------------------------------------------------------------------------
import CameraControls from "camera-controls";
import { Camera, Quat } from "livelink.js";
import * as THREE from "three";

//------------------------------------------------------------------------------
CameraControls.install({ THREE: THREE });

//------------------------------------------------------------------------------
export class DefaultCamera extends Camera {
    cameraControls: CameraControls | null = null;

    onCreate() {
        this.local_transform = { position: [0, 1, 5] };
        this.camera = {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: true, skybox: false, gradient: true },
        };
        this.perspective_lens = {
            aspectRatio: 1,
            fovy: 60,
            nearPlane: 0.1,
            farPlane: 10000,
        };

        this._initController();
    }

    private _initController() {
        if (this.viewport === null) {
            return;
        }

        const camera = new THREE.PerspectiveCamera(
            this.perspective_lens!.fovy,
            this.perspective_lens!.aspectRatio,
            this.perspective_lens!.nearPlane,
            this.perspective_lens!.farPlane,
        );
        const clock = new THREE.Clock();
        // create camera controls
        const cameraControls = new CameraControls(camera, this.viewport.canvas);
        this.cameraControls = cameraControls;

        cameraControls.setOrbitPoint(0, 0, 0);
        cameraControls.setPosition(...this.local_transform!.position!);

        cameraControls.addEventListener("update", () => this.onCameraUpdate());
        // animate the camera
        (function anim() {
            const delta = clock.getDelta();
            cameraControls.update(delta);
            requestAnimationFrame(anim);
        })();
    }

    onCameraUpdate() {
        if (!this.cameraControls) return;
        const cameraPosition = this.cameraControls.camera.position.toArray();
        const cameraOrientation = new THREE.Quaternion();
        this.cameraControls.camera.getWorldQuaternion(cameraOrientation);
        const cameraOrientationArray = cameraOrientation.toArray();
        this.local_transform!.position = cameraPosition;
        this.local_transform!.orientation = cameraOrientationArray as Quat;
    }
}

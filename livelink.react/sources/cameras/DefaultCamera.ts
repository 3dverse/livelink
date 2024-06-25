//------------------------------------------------------------------------------
import CameraControls from "camera-controls";
import { Camera, Quat, RenderingSurface, Vec3 } from "@3dverse/livelink";

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

//------------------------------------------------------------------------------
export class DefaultCamera extends Camera {
    cameraControls: CameraControls | null = null;

    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 1, 5] };
        this.camera = {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: true, skybox: false, gradient: true },
        };
        this.perspective_lens = {
            aspectRatio: this.viewport ? this.viewport?.aspect_ratio : 0,
            fovy: 60,
            nearPlane: 0.1,
            farPlane: 10000,
        };

        this._initController();
    }

    onDelete() {
        if (this.cameraControls) {
            this.cameraControls.dispose();
        }
    }

    private _initController() {
        if (this.viewport === null) {
            throw new Error("Attempt to initialize camera without a viewport");
        }

        const camera = new PerspectiveCamera(
            this.perspective_lens!.fovy,
            this.perspective_lens!.aspectRatio,
            this.perspective_lens!.nearPlane,
            this.perspective_lens!.farPlane,
        );
        const clock = new Clock();
        // create camera controls
        const canvas = (this.viewport.rendering_surface as RenderingSurface).canvas;
        const cameraControls = new CameraControls(camera, canvas);
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
        const cameraOrientation = new Quaternion();
        this.cameraControls.camera.getWorldQuaternion(cameraOrientation);
        const cameraOrientationArray = cameraOrientation.toArray();
        this.local_transform!.position = cameraPosition;
        this.local_transform!.orientation = cameraOrientationArray as Quat;
    }

    project(position: Vec3) {
        if (!this.cameraControls || !this.viewport) {
            throw new Error("CameraControls or Viewport is not initialized");
        }
        const projectedPosition = new Vector3(position[0], position[1], position[2])
            .project(this.cameraControls?.camera)
            .toArray();
        return [
            ((projectedPosition[0] + 1) * this.viewport.width) / 2,
            ((-projectedPosition[1] + 1) * this.viewport.height) / 2,
            projectedPosition[2],
        ];
    }
}

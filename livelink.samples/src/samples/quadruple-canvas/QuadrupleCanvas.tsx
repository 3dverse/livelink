//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Camera, Quat } from "livelink.js";
import { DefaultCamera } from "../../components/DefaultCamera";
import CameraControls from "camera-controls";
import * as THREE from "three";

//------------------------------------------------------------------------------
class MPRCamera extends Camera {
    static i = 0;
    cameraControls: CameraControls | null = null;
    onCreate() {
        const ar = this.viewport!.width / this.viewport!.height;

        const orientations: Array<Quat> = [
            [0.7071067811865475, 0, 0, 0.7071067811865476],
            [0, 0.7071067811865475, 0, -0.7071067811865476],
            [0, 0, 0, 1],
        ];

        this.local_transform = { position: [0, 0, 0], orientation: orientations[MPRCamera.i] };
        this.camera = {
            renderGraphRef: "c57253bf-40f2-44f1-942f-cc55dacea4f5",
            dataJSON: {},
        };
        this.orthographic_lens = {
            bottom: 1,
            top: -1,
            left: -ar,
            right: ar,
            zNear: -100,
            zFar: 100,
        };

        this._initController();
        ++MPRCamera.i;
    }

    private _initController() {
        if (this.viewport === null) {
            return;
        }

        const camera = new THREE.OrthographicCamera(
            this.orthographic_lens!.left,
            this.orthographic_lens!.right,
            this.orthographic_lens!.top,
            this.orthographic_lens!.bottom,
            this.orthographic_lens!.zNear,
            this.orthographic_lens!.zFar,
        );
        const clock = new THREE.Clock();
        // create camera controls
        const cameraControls = new CameraControls(camera, this.viewport.canvas);
        this.cameraControls = cameraControls;

        cameraControls.setOrbitPoint(0, 0, 0);
        cameraControls.setPosition(...this.local_transform!.position!);
        const t = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ][MPRCamera.i];
        cameraControls.setPosition(t[0], t[1], t[2]);
        cameraControls.setTarget(0, 0, 0);

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

//------------------------------------------------------------------------------
export default function QuadrupleCanvas() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);
    const canvasRef3 = useRef<HTMLCanvasElement>(null);
    const canvasRef4 = useRef<HTMLCanvasElement>(null);

    const { connect } = useLivelinkInstance({
        canvas_refs: [canvasRef1, canvasRef2, canvasRef3, canvasRef4],
        camera_constructors: [DefaultCamera, MPRCamera, MPRCamera, MPRCamera],
    });

    useEffect(() => {
        connect({ scene_id: "34bddfef-cb5c-45ce-b4e4-5d271ba0dcf1", token: "public_p54ra95AMAnZdTel" });
    }, []);

    return (
        <div className="w-full h-full grid grid-cols-2 gap-4 grid-rows-2 p-3">
            <Canvas canvasRef={canvasRef1} />
            <Canvas canvasRef={canvasRef2} />
            <Canvas canvasRef={canvasRef3} />
            <Canvas canvasRef={canvasRef4} />
        </div>
    );
}

//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import * as Livelink from "livelink.js";
import CameraControls from "camera-controls";
import * as THREE from "three";

CameraControls.install({ THREE: THREE });

//------------------------------------------------------------------------------
export function useLivelinkInstance({
    canvas_refs,
    token,
}: {
    canvas_refs: Array<React.RefObject<HTMLCanvasElement>>;
    token: string;
}): {
    instance: Livelink.Livelink | null;
    connect: ({ scene_id }: { scene_id: Livelink.UUID }) => Promise<Livelink.Livelink | null>;
    disconnect: () => void;
} {
    const [instance, setInstance] = useState<Livelink.Livelink | null>(null);

    useEffect(() => {
        return () => {
            instance?.close();
        };
    }, [instance]);

    return {
        instance,
        connect: async ({ scene_id }: { scene_id: Livelink.UUID }) => {
            if (canvas_refs.some(r => r.current === null)) {
                return null;
            }

            const inst = await connect(
                canvas_refs.map(r => r.current!),
                scene_id,
                token,
            );
            setInstance(inst);
            return inst;
        },
        disconnect: () => setInstance(null),
    };
}

//------------------------------------------------------------------------------
async function connect(canvas_elements: Array<HTMLCanvasElement>, scene_id: string, token: string) {
    const instance = await Livelink.Livelink.join_or_start({
        scene_id,
        token,
        session_selector: ({ sessions }: { sessions: Array<Livelink.SessionInfo> }) => sessions[0],
    });

    await configureClient(instance, canvas_elements);

    return instance;
}

//------------------------------------------------------------------------------
async function configureClient(instance: Livelink.Livelink, canvas_elements: Array<HTMLCanvasElement>) {
    const canvases = await Promise.all(
        canvas_elements.map(async canvas_element =>
            new Livelink.Canvas(instance, {
                canvas_element,
            }).init(),
        ),
    );

    for (const canvas of canvases) {
        instance.remote_rendering_surface.addCanvas({ canvas });
    }

    const client_config = {
        remote_canvas_size: instance.remote_rendering_surface.dimensions,
        encoder_config: {
            codec: 2,
            profile: 1,
            frame_rate: 60,
            lossy: true,
        },
        supported_devices: {
            keyboard: true,
            mouse: true,
            gamepad: true,
            hololens: false,
            touchscreen: false,
        },
    };

    // Step 1: configure the client on the renderer side, this informs the
    //         renderer on the client canvas size and available input devices
    //         and most importantly activates the session.
    await instance.configureClient({ client_config });

    // Step 2: decode received frames and draw them on the canvas.
    await instance.installFrameConsumer({
        frame_consumer: new Livelink.WebCodecsDecoder(instance.remote_rendering_surface),
    });

    // Step 3: setup the renderer to use the camera on a full canvas viewport.
    let i = 0;
    for (const canvas of canvases) {
        const camera = await instance.newEntity(MyCamera, "MyCam_" + i++);
        camera.canvas = canvas.html_element;
        const viewport = new Livelink.Viewport({ camera });
        canvas.attachViewport({ viewport });
    }

    instance.startStreaming();
    instance.startUpdateLoop({ fps: 60 });
}

//------------------------------------------------------------------------------

class MyCamera extends Livelink.Camera {
    private _canvas: HTMLCanvasElement | null = null;
    private _initialized = false;

    set canvas(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
    }

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
    }

    onUpdate() {
        if (this._initialized || !this._canvas) return;
        this._initialized = true;
        const camera = new THREE.PerspectiveCamera(
            this.perspective_lens!.fovy,
            this.perspective_lens!.aspectRatio,
            this.perspective_lens!.nearPlane,
            this.perspective_lens!.farPlane,
        );
        const clock = new THREE.Clock();
        // create camera controls
        const cameraControls = new CameraControls(camera, this._canvas);
        cameraControls.setOrbitPoint(0, 0, 0);
        cameraControls.setPosition(...this.local_transform!.position!);

        cameraControls.addEventListener("update", () => {
            const cameraPosition = cameraControls.camera.position.toArray();
            const cameraOrientation = new THREE.Quaternion();
            cameraControls.camera.getWorldQuaternion(cameraOrientation);
            const cameraOrientationArray = cameraOrientation.toArray();
            this.local_transform!.position = cameraPosition;
            this.local_transform!.orientation = cameraOrientationArray as Livelink.Quat;
        });
        // animate the camera
        (function anim() {
            const delta = clock.getDelta();
            cameraControls.update(delta);
            requestAnimationFrame(anim);
        })();
    }
}

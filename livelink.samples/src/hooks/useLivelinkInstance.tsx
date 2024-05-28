//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import * as Livelink from "livelink.js";
import CameraControls from "camera-controls";
import * as THREE from "three";

CameraControls.install({ THREE: THREE });

//------------------------------------------------------------------------------
export function useLivelinkInstance({
    canvas_refs,
    camera_constructors = [],
    token,
}: {
    canvas_refs: Array<React.RefObject<HTMLCanvasElement>>;
    camera_constructors?: (typeof Livelink.Camera)[];
    token: string;
}): {
    instance: Livelink.Livelink | null;
    connect: ({
        scene_id,
    }: {
        scene_id: Livelink.UUID;
    }) => Promise<{ instance: Livelink.Livelink; cameras: Livelink.Camera[] } | null>;
    disconnect: () => void;
    onConnect?: (instance: Livelink.Livelink) => void;
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

            const instance = await Livelink.Livelink.join_or_start({
                scene_id,
                token,
                session_selector: ({ sessions }: { sessions: Array<Livelink.SessionInfo> }) => sessions[0],
            });

            const cameras = await configureClient(
                instance,
                canvas_refs.map(r => r.current!),
                camera_constructors,
            );

            setInstance(instance);
            return { instance, cameras };
        },
        disconnect: () => setInstance(null),
    };
}

//------------------------------------------------------------------------------
async function configureClient(
    instance: Livelink.Livelink,
    canvas_elements: Array<HTMLCanvasElement>,
    camera_constructors: (typeof Livelink.Camera)[],
) {
    const viewports = await Promise.all(
        canvas_elements.map(async canvas_element =>
            new Livelink.Viewport(instance, {
                canvas_element,
            }).init(),
        ),
    );

    instance.remote_rendering_surface.addViewports({ viewports });

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
    const cameras = await Promise.all(
        viewports.map(async (viewport, i) => {
            const cameraConstructor = camera_constructors[i] || MyCamera;
            const camera = await instance.newEntity(cameraConstructor, "MyCam_" + i++);
            camera.initCamera(viewport);
            viewport.camera = camera;
            return camera;
        }),
    );

    instance.startStreaming();
    instance.startUpdateLoop({ fps: 60 });

    return cameras;
}

//------------------------------------------------------------------------------

export class MyCamera extends Livelink.Camera {
    cameraControls: CameraControls | null = null;

    initCamera(viewport: Livelink.Viewport<MyCamera>) {
        const canvas = viewport.canvas;
        this.initController(canvas);
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

    initController(canvas: HTMLCanvasElement) {
        const camera = new THREE.PerspectiveCamera(
            this.perspective_lens!.fovy,
            this.perspective_lens!.aspectRatio,
            this.perspective_lens!.nearPlane,
            this.perspective_lens!.farPlane,
        );
        const clock = new THREE.Clock();
        // create camera controls
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
        const cameraOrientation = new THREE.Quaternion();
        this.cameraControls.camera.getWorldQuaternion(cameraOrientation);
        const cameraOrientationArray = cameraOrientation.toArray();
        this.local_transform!.position = cameraPosition;
        this.local_transform!.orientation = cameraOrientationArray as Livelink.Quat;
    }
}

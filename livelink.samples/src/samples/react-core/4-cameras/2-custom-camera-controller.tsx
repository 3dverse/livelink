//------------------------------------------------------------------------------
import { CameraControllerBase, Entity } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Custom Controller",
    summary: "Shows how to create a custom camera controller.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
class CustomCameraController extends CameraControllerBase {
    #speed = 1;
    #elapsedTime: number = 0;

    constructor({ camera_entity }: { camera_entity: Entity; dom_element: HTMLElement }) {
        super({ camera_entity });
    }

    update(): void {
        const PERIOD = 1000 / 60;
        this._camera_entity.local_transform!.position![1] = 1 + Math.sin(this.#elapsedTime * 0.001) * this.#speed;
        this.#elapsedTime += PERIOD;
    }

    release(): void {}
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController controllerClass={CustomCameraController} />
            </Viewport>
        </Canvas>
    );
}

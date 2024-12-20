//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Double Viewport",
    summary: "Two viewports sharing the same canvas.",
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
function AppLayout() {
    const { cameraEntity: cameraEntity1 } = useCameraEntity();
    const { cameraEntity: cameraEntity2 } = useCameraEntity();

    return (
        <Canvas className={`${sampleCanvasClassName} flex`}>
            <Viewport cameraEntity={cameraEntity1} className="basis-[60%]">
                <CameraController />
            </Viewport>
            <Viewport cameraEntity={cameraEntity2} className="grow">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

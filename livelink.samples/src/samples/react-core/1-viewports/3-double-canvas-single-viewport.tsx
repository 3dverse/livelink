//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Double Canvas",
    summary: "Two canvases, each with their own viewport.",
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
        <div className="flex basis-full gap-2">
            <Canvas className={sampleCanvasClassName}>
                <Viewport cameraEntity={cameraEntity1} className="w-full h-full">
                    <CameraController />
                </Viewport>
            </Canvas>
            <Canvas className={sampleCanvasClassName}>
                <Viewport cameraEntity={cameraEntity2} className="w-full h-full">
                    <CameraController />
                </Viewport>
            </Canvas>
        </div>
    );
}

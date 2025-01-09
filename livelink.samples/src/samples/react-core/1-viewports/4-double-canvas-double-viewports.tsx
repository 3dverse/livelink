//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Multi-Viewports Double Canvas",
    summary: "Two canvases having two viewports each.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
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
    const { cameraEntity: cameraEntity3 } = useCameraEntity();
    const { cameraEntity: cameraEntity4 } = useCameraEntity();

    return (
        <div className="flex basis-full gap-2">
            <Canvas className="flex flex-col">
                <Viewport cameraEntity={cameraEntity1} className="basis-1/2">
                    <CameraController />
                </Viewport>
                <Viewport cameraEntity={cameraEntity2} className="basis-1/2">
                    <CameraController />
                </Viewport>
            </Canvas>
            <Canvas className="flex flex-row">
                <Viewport cameraEntity={cameraEntity3} className="basis-1/2">
                    <CameraController />
                </Viewport>
                <Viewport cameraEntity={cameraEntity4} className="basis-1/2">
                    <CameraController />
                </Viewport>
            </Canvas>
        </div>
    );
}

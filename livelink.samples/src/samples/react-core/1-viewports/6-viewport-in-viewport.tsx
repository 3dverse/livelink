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
    title: "Viewport in Viewport",
    summary: "A viewport inside a viewport.",
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
    const { cameraEntity: mainCamera } = useCameraEntity();
    const { cameraEntity: pipCamera } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={mainCamera} className="w-full h-full">
                <CameraController />
                <Viewport
                    cameraEntity={pipCamera}
                    className="absolute top-20 right-4 w-1/4 aspect-video border border-tertiary rounded-xl shadow-2xl"
                >
                    <CameraController />
                </Viewport>
            </Viewport>
        </Canvas>
    );
}

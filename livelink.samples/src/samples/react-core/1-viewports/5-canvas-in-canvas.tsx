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
    title: "Canvas in Canvas",
    summary: "A canvas inside a canvas.",
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
    const { cameraEntity: mainCamera } = useCameraEntity();
    const { cameraEntity: pipCamera } = useCameraEntity();
    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={mainCamera} className="relative w-full h-full">
                <CameraController />
                <Canvas className="top-20 right-4 w-1/4 aspect-video border border-tertiary rounded-xl shadow-2xl">
                    <Viewport cameraEntity={pipCamera} className="w-full h-full">
                        <CameraController />
                    </Viewport>
                </Canvas>
            </Viewport>
        </Canvas>
    );
}

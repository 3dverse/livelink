//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
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

    return (
        <Canvas className="flex max-h-screen">
            <Viewport
                cameraEntity={cameraEntity1}
                className="basis-[60%]"
                style={{
                    width: "500px",
                    height: "500px",
                    position: "absolute",
                    marginLeft: "-500px",
                }}
            >
                <CameraController />
            </Viewport>
            <Viewport cameraEntity={cameraEntity2}>
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";
import { useRef } from "react";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Default Controller",
    summary:
        "Shows how to create a default camera controller and get a reference to it.",
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
    const { cameraEntity } = useCameraEntity();
    const cameraControllerRef = useRef<DefaultCameraController>(null);

    const moveCamera = () => {
        const targetPosition = [5, 0, 0] as const;
        const lookAtPosition = [0, 0, 0] as const;
        cameraControllerRef.current?.setLookAt(
            ...targetPosition,
            ...lookAtPosition,
            true,
        );
    };

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                    <CameraController ref={cameraControllerRef} />
                </Viewport>
            </Canvas>
            <button
                className="absolute top-4 left-4 bg-ground p-2 rounded-xl"
                onClick={moveCamera}
            >
                Move Camera
            </button>
        </>
    );
}

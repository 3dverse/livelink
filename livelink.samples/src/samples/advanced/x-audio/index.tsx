//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    LivelinkContext,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";
import { useContext } from "react";

//------------------------------------------------------------------------------
const scene_id = "a896be32-2450-4dea-b59f-3c41901d7b0c";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
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

    return (
        <Canvas className="max-h-screen">
            <AudioPlay />
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function AudioPlay() {
    const { instance } = useContext(LivelinkContext);

    if (!instance) {
        return null;
    }

    return (
        <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2">
            <button
                className="button button-overlay"
                onClick={() => {
                    instance.stopSimulation();
                    instance.startSimulation();
                }}
            >
                Play Audio
            </button>
        </div>
    );
}

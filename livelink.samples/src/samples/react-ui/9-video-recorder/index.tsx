//------------------------------------------------------------------------------
import { useContext } from "react";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    LivelinkContext,
} from "@3dverse/livelink-react";
import {
    LoadingOverlay,
    VideoRecorder,
    ViewerPanel,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "5c19522d-a045-4554-a6d3-78bd87e44b86";
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
    const { isConnecting } = useContext(LivelinkContext);
    const { cameraEntity } = useCameraEntity({
        position: [20, 20, 20],
        eulerOrientation: [-45, 45, 0],
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <ViewerPanel className="absolute bottom-[5vh] left-1/2 -translate-x-1/2 rounded-md">
                    {!isConnecting && <VideoRecorder />}
                </ViewerPanel>
            </Viewport>
        </Canvas>
    );
}

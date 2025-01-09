//------------------------------------------------------------------------------
import { useContext, useEffect } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    CameraController,
    LivelinkContext,
} from "@3dverse/livelink-react";
import { InactivityWarning, LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    title: "Activity Watcher",
    summary: "A panel that detects activity when the inactivity timout is triggered.",
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
            InactivityWarningPanel={InactivityWarning}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { instance } = useContext(LivelinkContext);
    const { cameraEntity } = useCameraEntity();

    useEffect(() => {
        if (instance) {
            instance.activity_watcher.setTimeouts({ warn_after_seconds: 3, timeout_after_seconds: 10 });
        }
    }, [instance]);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

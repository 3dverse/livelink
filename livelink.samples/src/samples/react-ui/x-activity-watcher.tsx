//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    CameraController,
    LivelinkContext,
} from "@3dverse/livelink-react";
import { InactivityWarning } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";
import { useContext, useEffect } from "react";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
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
            LoadingPanel={LoadingSpinner}
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
            instance.activity_watcher.inactivity_warning = 3;
            instance.activity_watcher.inactivity_timeout = 10;
        }
    });

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

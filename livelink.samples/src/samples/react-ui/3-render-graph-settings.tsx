//------------------------------------------------------------------------------
import { Camera as LivelinkCamera } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    ViewportContext,
    LivelinkContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { InactivityWarning, RenderGraphSettings } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";
import { useContext } from "react";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Render Graph Settings",
    summary: "A widget that displays all settings of a given render graph.",
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
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <RenderGraphWidget />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function RenderGraphWidget() {
    const { instance } = useContext(LivelinkContext);
    const { camera } = useContext(ViewportContext);

    if (!instance || !camera) {
        return null;
    }

    return (
        <aside className="absolute top-4 left-4 bg-ground rounded-lg p-2">
            <p className="text-xs">Render graph settings</p>
            <RenderGraphSettings userToken={instance.session.token} cameraEntity={camera.camera_entity} />
        </aside>
    );
}

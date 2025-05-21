//------------------------------------------------------------------------------
import { useContext } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    ViewportContext,
    LivelinkContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import {
    InactivityWarning,
    LoadingOverlay,
    RenderGraphSettings,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
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
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
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
        <aside className="absolute top-4 left-4 w-[400px] bg-ground rounded-lg">
            <header className="pl-3 pr-8 py-1">
                <h1 className="font-primary text-2xs color-scondary tracking-wide">
                    Render graph settings
                </h1>
            </header>
            <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
                <RenderGraphSettings
                    userToken={instance.session.token}
                    cameraEntity={camera.camera_entity}
                />
            </div>
        </aside>
    );
}

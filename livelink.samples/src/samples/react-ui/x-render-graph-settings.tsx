//------------------------------------------------------------------------------
import { Camera as LivelinkCamera } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    Camera,
    DefaultCamera,
    ViewportContext,
    LivelinkContext,
} from "@3dverse/livelink-react";
import { InactivityWarning, RenderGraphSettings } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";
import { useContext, useEffect, useState } from "react";

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
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Camera class={DefaultCamera} name={"MyCamera"} />
                    <RenderGraphWidget />
                </Viewport>
            </Canvas>
        </Livelink>
    );
}
//------------------------------------------------------------------------------
function RenderGraphWidget() {
    const { instance } = useContext(LivelinkContext);
    const { viewport } = useContext(ViewportContext);
    const [cameraEntity, setCameraEntity] = useState<LivelinkCamera | null>(null);

    useEffect(() => {
        setCameraEntity(viewport?.camera ?? null);
    }, [viewport]);

    if (!instance) {
        return null;
    }

    return (
        <aside className="absolute top-4 left-4 bg-ground rounded-lg p-2">
            <p className="text-xs">Render graph settings</p>
            <RenderGraphSettings userToken={instance.session.token} cameraEntity={cameraEntity} />
        </aside>
    );
}

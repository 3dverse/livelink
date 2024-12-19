//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera } from "@3dverse/livelink-react";
import { InactivityWarning } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";

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
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Camera class={DefaultCamera} name={"MyCamera"} />
                </Viewport>
            </Canvas>
        </Livelink>
    );
}

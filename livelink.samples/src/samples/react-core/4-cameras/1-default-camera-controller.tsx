//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Default Controller",
    summary: "Shows how to customize the default camera controller.",
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
        >
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Camera class={DefaultCamera} name={"MyCamera"} />
                </Viewport>
            </Canvas>
        </Livelink>
    );
}

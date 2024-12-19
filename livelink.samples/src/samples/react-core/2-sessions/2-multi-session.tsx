//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    LoadingSpinner,
    sampleCanvasClassName,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id_1 = "d19ecb53-6488-48c1-a085-fab7de85b189";
const scene_id_2 = "965602b4-c522-41a1-9102-1dee1062f351";

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Multi Session",
    summary: "Two different sessions running on the same web page.",
    useCustomLayout: true,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <div className="w-full h-full flex relative pl-3">
            <SamplePlayer autoConnect={false} title={"First Session"}>
                <Livelink
                    sceneId={scene_id_1}
                    token={token}
                    LoadingPanel={LoadingSpinner}
                    ConnectionErrorPanel={DisconnectedModal}
                >
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport className="w-full h-full">
                            <Camera class={DefaultCamera} name="MyCamera" />
                        </Viewport>
                    </Canvas>
                </Livelink>
            </SamplePlayer>
            <SamplePlayer autoConnect={false} title={"Second Session"}>
                <Livelink
                    sceneId={scene_id_2}
                    token={token}
                    LoadingPanel={LoadingSpinner}
                    ConnectionErrorPanel={DisconnectedModal}
                >
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport className="w-full h-full">
                            <Camera class={DefaultCamera} name="MyCamera" />
                        </Viewport>
                    </Canvas>
                </Livelink>
            </SamplePlayer>
        </div>
    );
}

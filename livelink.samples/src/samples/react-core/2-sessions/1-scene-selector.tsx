//------------------------------------------------------------------------------
import { useState } from "react";

//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport, DefaultCamera, Camera } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scenes = [
    { name: "Scene 1", scene_id: "d19ecb53-6488-48c1-a085-fab7de85b189" },
    { name: "Scene 2", scene_id: "965602b4-c522-41a1-9102-1dee1062f351" },
];

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Scene Selector",
    summary: "Change scene using the same app setup",
    useCustomLayout: true,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [selectedSceneId, setSceneId] = useState<UUID | null>(null);

    return (
        <>
            {selectedSceneId && (
                <Livelink
                    sceneId={selectedSceneId}
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
            )}
            <SceneSelector selectedSceneId={selectedSceneId} setSceneId={setSceneId} />
        </>
    );
}

//------------------------------------------------------------------------------
function SceneSelector({
    selectedSceneId,
    setSceneId,
}: {
    selectedSceneId: string | null;
    setSceneId: (sceneId: string) => void;
}) {
    return (
        <div className="absolute bottom-4 flex items-center w-full justify-center">
            <select
                className="select select-primary min-w-[20rem]"
                value={selectedSceneId || ""}
                onChange={event => setSceneId(event.target.value)}
            >
                <option value="" disabled>
                    Pick a scene
                </option>
                {scenes.map((item, i) => (
                    <option key={i} value={item.scene_id}>
                        {item.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

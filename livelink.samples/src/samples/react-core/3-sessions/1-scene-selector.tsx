//------------------------------------------------------------------------------
import { useState } from "react";

//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scenes = [
    { name: "Scene 1", scene_id: "d19ecb53-6488-48c1-a085-fab7de85b189" },
    { name: "Scene 2", scene_id: "965602b4-c522-41a1-9102-1dee1062f351" },
];

//------------------------------------------------------------------------------
export default function SceneSelector() {
    const [selectedSceneId, setSceneId] = useState<UUID | null>(null);

    return (
        <div className="w-full h-full relative">
            <div className="w-full h-full p-3 lg:pl-0">
                {selectedSceneId && (
                    <Livelink
                        scene_id={selectedSceneId}
                        token={token}
                        loader={<LoadingSpinner />}
                        disconnectedModal={<DisconnectedModal />}
                    >
                        <Canvas className={sampleCanvasClassName}>
                            <Viewport />
                        </Canvas>
                    </Livelink>
                )}
            </div>
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
                <select
                    className="select select-primary w-full min-w-[20rem]"
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
        </div>
    );
}

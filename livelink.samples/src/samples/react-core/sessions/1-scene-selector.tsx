//------------------------------------------------------------------------------
import { useState } from "react";
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";
import type { UUID } from "@3dverse/livelink";

import { LoadingSpinner } from "../../../styles/components/LoadingSpinner";
import { sampleCanvasClassName } from "../../../styles/components/Canvas";
import { DisconnectedModal } from "../../../styles/components/DisconnectedModal";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
const scenes = [
    { name: "Scene 1", scene_id: "d19ecb53-6488-48c1-a085-fab7de85b189" },
    { name: "Scene 2", scene_id: "965602b4-c522-41a1-9102-1dee1062f351" },
];

//------------------------------------------------------------------------------
export default function SceneSelector() {
    const [scene_id, setSceneId] = useState<UUID | null>(null);

    return (
        <div className="w-full h-full relative">
            <div className="w-full h-full p-3 lg:pl-0">
                {scene_id && (
                    <Livelink
                        scene_id={scene_id}
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
                    value={scene_id || ""}
                    onChange={event => {
                        setSceneId(event.target.value);
                    }}
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

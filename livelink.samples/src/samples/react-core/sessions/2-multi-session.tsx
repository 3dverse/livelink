//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

import { SamplePlayer } from "../../../components/Player";
import { sampleCanvasClassName } from "../../../styles/components/Canvas";
import { LoadingSpinner } from "../../../styles/components/LoadingSpinner";
import { DisconnectedModal } from "../../../styles/components/DisconnectedModal";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
const scene_id_1 = "d19ecb53-6488-48c1-a085-fab7de85b189";
const scene_id_2 = "965602b4-c522-41a1-9102-1dee1062f351";

//------------------------------------------------------------------------------
export default function MultiSession() {
    return (
        <div className="w-full h-full flex">
            <SamplePlayer>
                <Livelink
                    scene_id={scene_id_1}
                    token={token}
                    loader={<LoadingSpinner />}
                    disconnectedModal={<DisconnectedModal />}
                >
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport />
                    </Canvas>
                </Livelink>
            </SamplePlayer>

            <SamplePlayer>
                <Livelink
                    scene_id={scene_id_2}
                    token={token}
                    loader={<LoadingSpinner />}
                    disconnectedModal={<DisconnectedModal />}
                >
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport />
                    </Canvas>
                </Livelink>
            </SamplePlayer>
        </div>
    );
}

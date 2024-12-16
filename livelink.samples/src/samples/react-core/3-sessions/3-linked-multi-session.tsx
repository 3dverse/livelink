//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

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
export default function LinkedMultiSession() {
    return (
        <SamplePlayer>
            <div className="flex basis-full relative">
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
            </div>
            <div className="flex basis-full relative">
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
            </div>
        </SamplePlayer>
    );
}

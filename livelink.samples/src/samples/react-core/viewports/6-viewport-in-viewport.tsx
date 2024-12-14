//------------------------------------------------------------------------------
import { RelativeRect } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

import { SamplePlayer } from "../../../components/Player";
import { LoadingSpinner } from "../../../styles/components/LoadingSpinner";
import { sampleCanvasClassName } from "../../../styles/components/Canvas";
import { DisconnectedModal } from "../../../styles/components/DisconnectedModal";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function ViewportInViewport() {
    return (
        <SamplePlayer>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <Canvas className={sampleCanvasClassName}>
                    <Viewport>
                        <Viewport rect={new RelativeRect({ left: 0.2, top: 0.2, width: 0.2, height: 0.2 })} />
                    </Viewport>
                </Canvas>
            </Livelink>
        </SamplePlayer>
    );
}

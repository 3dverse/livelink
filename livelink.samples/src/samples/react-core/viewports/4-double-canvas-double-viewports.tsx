//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";
import { RelativeRect } from "@3dverse/livelink";

import { SamplePlayer } from "../../../components/Player";
import { LoadingSpinner } from "../../../styles/components/LoadingSpinner";
import { sampleCanvasClassName } from "../../../styles/components/Canvas";
import { DisconnectedModal } from "../../../styles/components/DisconnectedModal";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function DoubleCanvasDoubleViewports() {
    return (
        <SamplePlayer>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <div className="flex basis-full">
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport rect={new RelativeRect({ top: 0, width: 1, height: 0.5 })} />
                        <Viewport rect={new RelativeRect({ top: 0.5, width: 1, height: 0.5 })} />
                    </Canvas>
                </div>
                <div className="flex basis-full">
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport rect={new RelativeRect({ left: 0, width: 0.5, height: 1 })} />
                        <Viewport rect={new RelativeRect({ left: 0.5, width: 0.5, height: 1 })} />
                    </Canvas>
                </div>
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

import { SamplePlayer } from "../../../components/Player";
import { LoadingSpinner } from "../../../styles/components/LoadingSpinner";
import { sampleCanvasClassName } from "../../../styles/components/Canvas";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "80ec3064-df96-41fa-be93-c6dbeb985278";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function DoubleCanvasSingleViewport() {
    return (
        <SamplePlayer>
            <Livelink scene_id={scene_id} token={token} loader={<LoadingSpinner />}>
                <div className="flex basis-full">
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport />
                    </Canvas>
                </div>
                <div className="flex basis-full">
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport />
                    </Canvas>
                </div>
            </Livelink>
        </SamplePlayer>
    );
}

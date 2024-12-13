//------------------------------------------------------------------------------
import { RelativeRect } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

import { SamplePlayer } from "../../../components/Player";
import { LoadingSpinner } from "../../../styles/components/LoadingSpinner";
import { sampleCanvasClassName } from "../../../styles/components/Canvas";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "80ec3064-df96-41fa-be93-c6dbeb985278";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function SingleCanvasDoubleViewports() {
    return (
        <SamplePlayer>
            <Livelink scene_id={scene_id} token={token} loader={<LoadingSpinner />}>
                <Canvas className={sampleCanvasClassName}>
                    <Viewport rect={new RelativeRect({ left: 0, width: 0.5, height: 1 })} />
                    <Viewport rect={new RelativeRect({ left: 0.5, width: 0.5, height: 1 })} />
                </Canvas>
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
import { Livelink, Viewport } from "@3dverse/livelink-react";

import { SamplePlayer } from "../../components/Player";
import { StyledCanvas } from "../../styles/components/Canvas";
import { LoadingSpinner } from "../../styles/components/LoadingSpinner";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "80ec3064-df96-41fa-be93-c6dbeb985278";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
    return (
        <div className="relative h-full p-3 pl-0">
            <SamplePlayer>
                <Livelink scene_id={scene_id} token={token} loader={<LoadingSpinner />}>
                    <StyledCanvas>
                        <Viewport />
                    </StyledCanvas>
                </Livelink>
            </SamplePlayer>
        </div>
    );
}

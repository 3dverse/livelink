//------------------------------------------------------------------------------
import { Livelink, Viewport } from "@3dverse/livelink-react";
import StyledCanvas from "../../components/Canvas";

//------------------------------------------------------------------------------
export default function DoubleCanvas() {
    return (
        <Livelink scene_id="e7d69f14-d18e-446b-8df3-cbd24e10fa92" token="public_p54ra95AMAnZdTel">
            <div className="w-full h-full flex gap-3 p-3 lg:pl-0">
                <div className="flex basis-full">
                    <StyledCanvas>
                        <Viewport />
                    </StyledCanvas>
                </div>
                <div className="flex basis-full">
                    <StyledCanvas>
                        <Viewport />
                    </StyledCanvas>
                </div>
            </div>
        </Livelink>
    );
}

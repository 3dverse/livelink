//------------------------------------------------------------------------------
import { useState } from "react";
import { RelativeRect } from "@3dverse/livelink";
import { Livelink, Viewport, type LivelinkConnectParameters } from "@3dverse/livelink-react";
import StyledCanvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export default function MultiViewportCanvas() {
    const [started, setStarted] = useState(false);

    const livelinkSettings: LivelinkConnectParameters = {
        scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
        token: "public_p54ra95AMAnZdTel",
    };

    return (
        <div className="relative h-full p-3 pl-0">
            {started && (
                <Livelink {...livelinkSettings}>
                    <StyledCanvas>
                        <Viewport rect={new RelativeRect({ left: 0, width: 0.5, height: 1 })} />
                        <Viewport rect={new RelativeRect({ left: 0.5, width: 0.5, height: 1 })} />
                    </StyledCanvas>
                </Livelink>
            )}

            <CanvasActionBar isCentered={!started}>
                <button className="button button-primary" onClick={() => setStarted(!started)}>
                    {started ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </div>
    );
}

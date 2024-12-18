import { useRef } from "react";
import { useLivelinkInstance, useEntity } from "@3dverse/livelink-react";
import { SunPositionPicker } from "@3dverse/livelink-react-ui";

import { CanvasActionBar } from "../../../styles/components/CanvasActionBar";
import Canvas from "../../../components/Canvas";

//------------------------------------------------------------------------------
const SmartObjectManifest = {
    MySun: "9d69cad8-9590-44bf-bdfa-3278dcd3e9d4",
} as const;

//------------------------------------------------------------------------------
export default function SunPositionPickerSample() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });
    const theSun = useEntity({ instance, entity_uuid: SmartObjectManifest.MySun });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else {
            await connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
                token: "public_p54ra95AMAnZdTel",
                is_transient: true,
            });
        }
    };

    return (
        <>
            <div className="w-full h-full relative">
                <div className="w-full h-full p-3 lg:pl-0">
                    <Canvas canvasRef={canvasRef} />
                </div>

                {instance && (
                    <div className="fixed top-6 right-6">
                        <SunPositionPicker sun={theSun} />
                    </div>
                )}
                <CanvasActionBar isCentered={!instance}>
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                </CanvasActionBar>
            </div>
        </>
    );
}

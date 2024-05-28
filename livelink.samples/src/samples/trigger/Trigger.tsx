//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { Button, Range } from "react-daisyui";
import { useLiveLinkInstance } from "../../hooks/useLiveLinkInstance";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    MyTrigger: "40908492-100c-4749-8670-7df1148b818d",
    MyAnimSeq: "b540a665-4598-424f-ac6b-4147220c2df0",
};

//------------------------------------------------------------------------------
export default function Trigger() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [triggerState, setTriggerState] = useState("Idle");

    const { instance, connect, disconnect } = useLiveLinkInstance({
        canvas_refs: [canvasRef],
        token: "public_p54ra95AMAnZdTel",
    });

    const trigger = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "MyTrigger" });

    useEffect(() => {
        instance?.startSimulation();
        instance?.playAnimationSequence({ animation_sequence_id: SmartObjectManifest.MyAnimSeq, playback_speed: 0.1 });
    }, [instance]);

    useEffect(() => {
        if (trigger === null) {
            return;
        }

        trigger.__self.addEventListener("trigger-entered", () => {
            setTriggerState("Entered");
        });

        trigger.__self.addEventListener("trigger-exited", () => {
            setTriggerState("Exited");
        });
    }, [trigger, setTriggerState]);

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "730bed3e-b4d3-48eb-8cf7-65a86fe68a42",
            });
        }
    };

    return (
        <>
            <div className="w-full h-full flex basis-full grow p-4">
                <Canvas canvasRef={canvasRef} />
            </div>
            <div className="flex items-center gap-2 pb-4">
                <Button shape="circle" variant="outline" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </Button>
                {triggerState}

                <Range
                    min={-1}
                    max={1}
                    step={0.2}
                    defaultValue={0.1}
                    onChange={e =>
                        instance?.playAnimationSequence({
                            animation_sequence_id: SmartObjectManifest.MyAnimSeq,
                            playback_speed: Number(e.target.value),
                        })
                    }
                />
            </div>
        </>
    );
}

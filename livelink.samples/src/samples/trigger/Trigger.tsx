//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimationSequence } from "@3dverse/livelink";
import { Range } from "react-daisyui";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, useEntity } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest = {
    MyTrigger: "40908492-100c-4749-8670-7df1148b818d",
    MyAnimSeq: "b540a665-4598-424f-ac6b-4147220c2df0",
} as const;

//------------------------------------------------------------------------------
export default function Trigger() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [triggerState, setTriggerState] = useState("Idle");
    const [messages, setMessages] = useState<Array<string>>([]);
    const [animationSeq, setAnimationSeq] = useState<AnimationSequence | null>(null);
    const onTriggerEntered = useCallback(() => setTriggerState("Entered"), [setTriggerState]);
    const onTriggerExited = useCallback(() => setTriggerState("Exited"), [setTriggerState]);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const trigger = useEntity({ instance, entity_uuid: SmartObjectManifest.MyTrigger });

    useEffect(() => {
        if (instance) {
            instance.startSimulation();
            setAnimationSeq(
                instance.scene.getAnimationSequence({ animation_sequence_id: SmartObjectManifest.MyAnimSeq }),
            );
        }
    }, [instance, setAnimationSeq]);

    useEffect(() => {
        if (trigger === null) {
            return;
        }
        trigger.addEventListener("trigger-entered", onTriggerEntered);
        trigger.addEventListener("trigger-exited", onTriggerExited);
        return () => {
            trigger.removeEventListener("trigger-entered", onTriggerEntered);
            trigger.removeEventListener("trigger-exited", onTriggerExited);
        };
    }, [trigger, onTriggerEntered, onTriggerExited]);

    useEffect(() => {
        if (!instance) {
            return;
        }
        const msgs = messages.length > 9 ? [...messages.slice(-9, 9)] : [...messages, triggerState];
        setMessages(msgs);

        return () => {
            setMessages([]);
        };
    }, [instance, triggerState, setMessages]);

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "730bed3e-b4d3-48eb-8cf7-65a86fe68a42", token: "public_p54ra95AMAnZdTel" });
        }
    };

    return (
        <>
            <div className="relative w-full h-full">
                <div className="w-full h-full p-3 lg:pl-0">
                    <Canvas canvasRef={canvasRef} />
                </div>
                {messages.length > 0 && (
                    <div className="absolute bottom-8 right-8 w-80 flex flex-col">
                        {messages.map((msg, i) => (
                            <div key={i} className={`chat chat-${i % 2 ? "start" : "end"}`}>
                                <div className="chat-image avatar">
                                    <div className="w-10 rounded-full">
                                        <img
                                            alt="Tailwind CSS chat bubble component"
                                            src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg"
                                        />
                                    </div>
                                </div>
                                <div className="chat-bubble">{msg}</div>
                            </div>
                        ))}
                    </div>
                )}
                <CanvasActionBar isCentered={!instance}>
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                    {instance && (
                        <Range
                            min={-1}
                            max={1}
                            step={0.2}
                            defaultValue={0}
                            onChange={e => animationSeq?.play({ playback_speed: Number(e.target.value) })}
                        />
                    )}
                </CanvasActionBar>
            </div>
        </>
    );
}

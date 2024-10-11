//------------------------------------------------------------------------------
import { useRef, useState } from "react";
import { Livelink, GatewayDisconnectedReason } from "@3dverse/livelink";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });
    const [inactivityWarning, setInactivityWarning] = useState<boolean>(false);
    const [isDisconnected, setIsDisconnected] = useState<boolean>(false);
    const [isDisconnectedForInactivity, setIsDisconnectedForInactivity] = useState<boolean>(false);

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
            instance!.activity_watcher.removeEventListener("on-warning", onInactivityWarning);
        } else if (canvasRef.current) {
            connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
                token: "public_p54ra95AMAnZdTel",
                onConnected,
            });
        }
    };

    function onInactivityWarningValidated() {
        instance!.activity_watcher.reset();
        setInactivityWarning(false);
    }

    function onInactivityWarning() {
        setInactivityWarning(true);
    }

    function onDisconnected(event: Event) {
        const reason: GatewayDisconnectedReason = (event as CustomEvent).detail.reason;
        setIsDisconnected(true);
        setIsDisconnectedForInactivity(reason === "inactivity");
    }

    async function onConnected({ instance }: { instance: Livelink }) {
        instance.activity_watcher.addEventListener("on-warning", onInactivityWarning);
        instance.session.addEventListener("on-disconnected", onDisconnected);
    }

    return (
        <div className="relative h-full p-3 lg:pl-0">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
            {instance && inactivityWarning && !isDisconnected && (
                <div className="absolute top-0 bottom-0 left-0 right-0 p-3 content-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <div className="text-sm">You've been idle too long</div>
                        <div className="text-sm">You'll be disconnected soon</div>
                        <div className="text-sm">Are you still there?</div>
                        <button className="button button-primary" onClick={onInactivityWarningValidated}>
                            Yes!
                        </button>
                    </div>
                </div>
            )}
            {isDisconnected && (
                <div className="absolute top-0 bottom-0 left-0 right-0 p-3 content-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <div className="text-sm">
                            {`You've been disconnected${isDisconnectedForInactivity ? " for inactivity" : ""}`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

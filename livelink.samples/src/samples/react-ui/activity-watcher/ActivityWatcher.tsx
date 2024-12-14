//------------------------------------------------------------------------------
import { useRef, useState } from "react";
import { Livelink, GatewayDisconnectedReason } from "@3dverse/livelink";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import { InactivityWarning } from "@3dverse/livelink-react-ui";
import LegacyCanvas from "../../../components/Canvas";
import { CanvasActionBar } from "../../../components/SamplePlayer/CanvasActionBar";

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });
    const [isDisconnected, setIsDisconnected] = useState<boolean>(false);
    const [isDisconnectedForInactivity, setIsDisconnectedForInactivity] = useState<boolean>(false);

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
                token: "public_p54ra95AMAnZdTel",
                onConnected,
            });
        }
    };

    function onDisconnected(event: Event) {
        const reason: GatewayDisconnectedReason = (event as CustomEvent).detail.reason;
        setIsDisconnected(true);
        setIsDisconnectedForInactivity(reason === "inactivity");
    }

    async function onConnected({ instance }: { instance: Livelink }) {
        instance.session.addEventListener("on-disconnected", onDisconnected);
    }

    return (
        <div className="relative h-full p-3 lg:pl-0">
            <LegacyCanvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>

            <InactivityWarning instance={instance} />

            {isDisconnected && (
                <div className="absolute top-0 bottom-0 left-0 right-0 p-3 content-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <div className="text-sm">
                            You've been disconnected{isDisconnectedForInactivity ? " for inactivity" : ""}.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

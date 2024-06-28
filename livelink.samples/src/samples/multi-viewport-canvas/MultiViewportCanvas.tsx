//------------------------------------------------------------------------------
import { useRef } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import { RelativeRect } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export default function MultiViewportCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({
        views: [
            { canvas_ref: canvasRef, rect: new RelativeRect({ left: 0, width: 0.5, height: 1 }) },
            { canvas_ref: canvasRef, rect: new RelativeRect({ left: 0.5, width: 0.5, height: 1 }) },
        ],
    });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
        }
    };

    return (
        <div className="relative h-full p-3 pl-0">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </div>
    );
}

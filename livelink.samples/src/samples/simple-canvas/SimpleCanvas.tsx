//------------------------------------------------------------------------------
import { useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({
        canvas_refs: [canvasRef],
        token: "public_p54ra95AMAnZdTel",
    });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
            });
        }
    };

    return (
        <div className="relative h-full max-h-screen p-3">
            <Canvas canvasRef={canvasRef} />
            <div
                className={`
                    absolute left-1/2 -translate-x-1/2 -translate-y-1/2
                    flex items-center gap-2 pb-4
                    transition-all ${instance ? "bottom-0" : "bottom-1/2"}
                `}
            >
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </div>
        </div>
    );
}

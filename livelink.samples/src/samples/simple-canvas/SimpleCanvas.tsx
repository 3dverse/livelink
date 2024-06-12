//------------------------------------------------------------------------------
import { useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { connectButtonContainerClassName } from "../../styles/specific";

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
        }
    };

    return (
        <div className="relative h-full p-3">
            <Canvas canvasRef={canvasRef} />

            <div className={connectButtonContainerClassName(!!instance)}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </div>
        </div>
    );
}

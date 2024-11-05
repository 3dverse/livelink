//------------------------------------------------------------------------------
import { useRef } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "80ec3064-df96-41fa-be93-c6dbeb985278";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id, token });
        }
    };

    return (
        <div className="relative h-full p-3 lg:pl-0">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </div>
    );
}

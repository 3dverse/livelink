//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";

//------------------------------------------------------------------------------
export default function DoubleCanvas() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const { connect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef1 }, { canvas_ref: canvasRef2 }] });

    useEffect(() => {
        connect({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92", token: "public_p54ra95AMAnZdTel" });
    }, []);

    return (
        <div className="w-full h-full flex gap-4 p-3">
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef1} />
            </div>
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef2} />
            </div>
        </div>
    );
}

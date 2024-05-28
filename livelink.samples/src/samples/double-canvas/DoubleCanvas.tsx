//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";

//------------------------------------------------------------------------------
export default function DoubleCanvas() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const { connect } = useLivelinkInstance({
        canvas_refs: [canvasRef1, canvasRef2],
        token: "public_p54ra95AMAnZdTel",
    });

    useEffect(() => {
        connect({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92" });
    }, []);

    return (
        <div className="w-full h-full flex basis-full flex-row grow gap-4 p-4">
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef1} />
            </div>
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef2} />
            </div>
        </div>
    );
}

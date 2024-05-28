//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";

//------------------------------------------------------------------------------
export default function MultiSession() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const { connect: connect1 } = useLivelinkInstance({
        canvas_refs: [canvasRef1],
        token: "public_p54ra95AMAnZdTel",
    });

    const { connect: connect2 } = useLivelinkInstance({
        canvas_refs: [canvasRef2],
        token: "public_p54ra95AMAnZdTel",
    });

    useEffect(() => {
        connect1({
            scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92",
        });
        connect2({
            scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
        });
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

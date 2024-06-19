//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
export default function MultiSession() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const { connect: connect1 } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef1 }] });
    const { connect: connect2 } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef2 }] });

    useEffect(() => {
        connect1({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92", token: "public_p54ra95AMAnZdTel" });
        connect2({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
    }, []);

    return (
        <div className="w-full h-full flex flex-row gap-3 p-3 pl-0">
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef1} />
            </div>
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef2} />
            </div>
        </div>
    );
}

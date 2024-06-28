//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import { Camera } from "@3dverse/livelink";

//------------------------------------------------------------------------------
function degreesToRadian(degrees: number) {
    return (degrees * Math.PI) / 180.0;
}

//------------------------------------------------------------------------------
export default function LargerViewWithSamePerspective() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const viewport_size = [640, 480];
    const original_fov = 60;
    const increased_fov = 70;
    const factor = Math.tan(degreesToRadian(increased_fov / 2)) / Math.tan(degreesToRadian(original_fov / 2));

    const { connect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef1 }, { canvas_ref: canvasRef2 }] });

    useEffect(() => {
        connect({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92", token: "public_p54ra95AMAnZdTel" }).then(
            (response: { cameras: Array<Camera | null> } | null) => {
                if (!response) return;
                response.cameras[0]!.perspective_lens!.fovy = original_fov;
                response.cameras[1]!.perspective_lens!.fovy = increased_fov;
            },
        );
    }, []);

    return (
        <div className="w-full h-full flex flex-col gap-3 p-3 lg:pl-0">
            <div style={{ width: viewport_size[0], height: viewport_size[1] }} className="relative">
                <Canvas canvasRef={canvasRef1} />
            </div>
            <div style={{ width: viewport_size[0] * factor, height: viewport_size[1] * factor }} className="relative">
                <Canvas canvasRef={canvasRef2} />
            </div>
        </div>
    );
}

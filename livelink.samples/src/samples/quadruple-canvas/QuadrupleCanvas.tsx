//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLiveLinkInstance } from "../../hooks/useLiveLinkInstance";

//------------------------------------------------------------------------------
export default function QuadrupleCanvas() {
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const canvasRef3 = useRef<HTMLCanvasElement>(null);
  const canvasRef4 = useRef<HTMLCanvasElement>(null);

  const { connect } = useLiveLinkInstance({
    canvas_refs: [canvasRef1, canvasRef2, canvasRef3, canvasRef4],
    token: "public_p54ra95AMAnZdTel",
  });

  useEffect(() => {
    connect({
      scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92",
    });
  }, []);

  return (
    <div className="w-full h-full grid grid-cols-2 gap-4 grid-rows-2 p-4">
      <div className="flex basis-full">
        <Canvas canvasRef={canvasRef1} />
      </div>
      <div className="flex basis-full">
        <Canvas canvasRef={canvasRef2} />
      </div>
      <div className="flex basis-full">
        <Canvas canvasRef={canvasRef3} />
      </div>
      <div className="flex basis-full">
        <Canvas canvasRef={canvasRef4} />
      </div>
    </div>
  );
}

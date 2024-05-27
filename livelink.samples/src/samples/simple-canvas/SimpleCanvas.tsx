//------------------------------------------------------------------------------
import { useRef } from "react";
import Canvas from "../../components/Canvas";
import { Button } from "react-daisyui";
import { useLiveLinkInstance } from "../../hooks/useLiveLinkInstance";

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { instance, connect, disconnect } = useLiveLinkInstance({
    canvas_refs: [canvasRef],
    scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
    token: "public_p54ra95AMAnZdTel",
  });

  const toggleConnection = async () => {
    if (instance) {
      disconnect();
    } else if (canvasRef.current) {
      connect();
    }
  };

  return (
    <>
      <div className="w-full h-full flex basis-full grow p-4">
        <Canvas canvasRef={canvasRef} />
      </div>
      <div className="flex items-center gap-2 pb-4">
        <Button shape="circle" variant="outline" onClick={toggleConnection}>
          {instance ? "Disconnect" : "Connect"}
        </Button>
      </div>
    </>
  );
}

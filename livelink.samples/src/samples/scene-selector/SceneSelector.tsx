//------------------------------------------------------------------------------
import { useRef } from "react";
import Canvas from "../../components/Canvas";
import { Select } from "react-daisyui";
import { useLiveLinkInstance } from "../../hooks/useLiveLinkInstance";

//------------------------------------------------------------------------------
const scenes = [
  { name: "Droid", scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7" },
  { name: "Sponza", scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d" },
];
//------------------------------------------------------------------------------
export default function SceneSelector() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { instance, connect, disconnect } = useLiveLinkInstance({
    canvas_refs: [canvasRef],
    token: "public_p54ra95AMAnZdTel",
  });

  const openScene = ({ scene_id }: { scene_id: string }) => {
    if (instance) {
      disconnect();
    }
    if (canvasRef.current) {
      connect({
        scene_id,
      });
    }
  };

  return (
    <>
      <div className="w-full h-full flex basis-full grow p-4">
        <Canvas canvasRef={canvasRef} />
      </div>
      <div className="flex w-full component-preview p-4 items-center justify-center gap-2 font-sans">
        <Select
          className="w-full max-w-xs"
          value={"default"}
          onChange={(event) => {
            openScene({ scene_id: event.target.value });
          }}
        >
          <option value={"default"} disabled>
            Pick a scene
          </option>
          {scenes.map((item, i) => (
            <option key={i} value={item.scene_id}>
              {item.name}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}

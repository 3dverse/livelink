import { useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import * as LiveLink from "livelink.js";
import { Button, Input, Range } from "react-daisyui";
import { useLiveLinkInstance } from "../../hooks/useLiveLinkInstance";

//------------------------------------------------------------------------------
const SmartObjectManifest: Record<string, string> = {
  MyLight: "c03314f2-c943-41be-ae17-f0d655cf1d11",
};

//------------------------------------------------------------------------------
async function findSmartObject(
  instance: LiveLink.LiveLink,
  objectName: string
) {
  if (!(objectName in SmartObjectManifest)) {
    throw new Error(`Unknown SmartObject ${objectName}`);
  }

  if (!instance) {
    return { isLoading: true, entity: null };
  }

  const entity = await instance.findEntity(LiveLink.Entity, {
    entity_uuid: SmartObjectManifest[objectName],
  });

  return { isLoading: false, entity };
}

function rgbToHex(c: Array<number>) {
  function componentToHex(c: number) {
    const hex = (c * 255).toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

  return (
    "#" + componentToHex(c[0]) + componentToHex(c[1]) + componentToHex(c[2])
  );
}

function hexToRgb(h: string): [number, number, number] {
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

//------------------------------------------------------------------------------
export default function SmartObject() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entity, setEntity] = useState<LiveLink.Entity | null>(null);

  const { instance, connect, disconnect } = useLiveLinkInstance({
    canvas_refs: [canvasRef],
    scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
    token: "public_p54ra95AMAnZdTel",
  });

  const toggleConnection = async () => {
    if (instance) {
      setEntity(null);
      disconnect();
    } else if (canvasRef.current) {
      const inst = await connect();
      if (!inst) {
        return;
      }
      const { entity: soLight } = await findSmartObject(inst, "MyLight");

      if (soLight) {
        soLight.__self.addEventListener("entity-updated", () => {
          setEntity(null);
          setTimeout(() => setEntity(soLight), 0);
        });
      }

      setEntity(soLight);
    }
  };

  return (
    <>
      <div className="w-full h-full flex basis-full grow p-4">
        <Canvas canvasRef={canvasRef} />

        {entity && (
          <div className="fixed top-6 right-6">
            <Input
              type="color"
              className="p-1 h-10 w-14 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"
              id="hs-color-input"
              defaultValue={rgbToHex(entity.point_light.color)}
              title="Choose your color"
              onChange={(e) =>
                (entity.point_light.color = hexToRgb(
                  e.target.value.substring(1)
                ))
              }
            />
            <Range
              min={0}
              max={10}
              defaultValue={entity.point_light.intensity}
              onChange={(e) =>
                (entity.point_light.intensity = Number(e.target.value))
              }
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pb-4">
        <Button shape="circle" variant="outline" onClick={toggleConnection}>
          {instance ? "Disconnect" : "Connect"}
        </Button>
      </div>
    </>
  );
}

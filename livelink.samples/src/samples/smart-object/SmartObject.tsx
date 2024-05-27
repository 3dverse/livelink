import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import * as LiveLink from "livelink.js";
import { Button, Input, Range } from "react-daisyui";

export class MyCamera extends LiveLink.Camera {
  onCreate() {
    this.local_transform = { position: [0, 1, 5] };
    this.camera = {
      renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
      dataJSON: { grid: true, skybox: false, gradient: true },
    };
    this.perspective_lens = {};
  }

  onUpdate({ elapsed_time }: { elapsed_time: number }) {
    this.local_transform!.position![1] = 1 + Math.sin(elapsed_time);
  }
}

async function configureClient(
  instance: LiveLink.LiveLink,
  canvas_element_id: string
) {
  const canvas = await new LiveLink.Canvas(instance, {
    canvas_element_id,
  }).init();

  instance.remote_rendering_surface.addCanvas({ canvas });

  const client_config = {
    remote_canvas_size: instance.remote_rendering_surface.dimensions,
    encoder_config: {
      codec: 2,
      profile: 1,
      frame_rate: 60,
      lossy: true,
    },
    supported_devices: {
      keyboard: true,
      mouse: true,
      gamepad: true,
      hololens: false,
      touchscreen: false,
    },
  };

  // Step 1: configure the client on the renderer side, this informs the
  //         renderer on the client canvas size and available input devices
  //         and most importantly activates the session.
  await instance.configureClient({ client_config });

  // Step 1': get or create a camera to render frames (not dependent on
  //          anything)
  const camera = await instance.newEntity(MyCamera, "MyCam");

  // Step 2: decode received frames and draw them on the canvas.
  await instance.installFrameConsumer({
    frame_consumer: new LiveLink.WebCodecsDecoder(
      instance.remote_rendering_surface
    ),
  });

  // Step 3: setup the renderer to use the camera on a full canvas viewport.
  const viewport = new LiveLink.Viewport({ camera });
  canvas.attachViewport({ viewport });
  instance.startStreaming();
  instance.startUpdateLoop({ fps: 60 });
}

//------------------------------------------------------------------------------

async function connect(canvas_id: string) {
  const instance = await LiveLink.LiveLink.join_or_start({
    scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
    token: "public_p54ra95AMAnZdTel",
    session_selector: ({
      sessions,
    }: {
      sessions: Array<LiveLink.SessionInfo>;
    }) => sessions[0],
  });

  await configureClient(instance, canvas_id);

  return instance;
}

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
  const instanceRef = useRef<LiveLink.LiveLink | null>(null);
  const [entity, setEntity] = useState<LiveLink.Entity | null>(null);

  useEffect(() => {
    return () => {
      instanceRef.current?.close();
    };
  }, [instanceRef]);

  const toggleConnection = async () => {
    if (instanceRef.current) {
      await instanceRef.current.close();
      instanceRef.current = null;
      setEntity(null);
    } else if (canvasRef.current) {
      instanceRef.current = await connect(canvasRef.current.id);
      const { entity: soLight } = await findSmartObject(
        instanceRef.current,
        "MyLight"
      );
      if (soLight) {
        soLight[LiveLink.IDENTITY].addEventListener("entity-updated", () => {
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
          {instanceRef.current ? "Disconnect" : "Connect"}
        </Button>
      </div>
    </>
  );
}

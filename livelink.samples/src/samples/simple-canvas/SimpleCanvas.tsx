import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import * as LiveLink from "livelink.js";
import { SessionInfo } from "@livelink.core";
import { Button } from "react-daisyui";

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
  console.log(canvas_element_id);
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
}

//------------------------------------------------------------------------------

async function connect(canvas_id: string) {
  const instance = await LiveLink.LiveLink.join_or_start({
    scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
    token: "public_p54ra95AMAnZdTel",
    session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) =>
      sessions[0],
  });

  await configureClient(instance, canvas_id);

  return instance;
}

//------------------------------------------------------------------------------
export default function SimpleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<LiveLink.LiveLink | null>(null);

  useEffect(() => {
    return () => {
      instanceRef.current?.close();
    };
  }, [instanceRef]);

  const toggleConnection = async () => {
    if (instanceRef.current) {
      await instanceRef.current.close();
      instanceRef.current = null;
    } else if (canvasRef.current) {
      instanceRef.current = await connect(canvasRef.current.id);
    }
  };

  return (
    <>
      <div className="w-full h-full flex basis-full grow p-4">
        <Canvas canvasRef={canvasRef} />
      </div>
      <div className="flex items-center gap-2 pb-4">
        <Button shape="circle" variant="outline" onClick={toggleConnection}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>
    </>
  );
}

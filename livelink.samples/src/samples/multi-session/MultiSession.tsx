import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import * as LiveLink from "livelink.js";
import { SessionInfo } from "@livelink.core";

export class MyCamera extends LiveLink.Camera {
  private _speed = 1;

  onCreate() {
    this.local_transform = { position: [0, 1, 5] };
    this.camera = {
      renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
      dataJSON: { grid: true, skybox: false, gradient: true },
    };
    this.perspective_lens = {};
    this._speed = 1 + Math.random();
  }

  onUpdate({ elapsed_time }: { elapsed_time: number }) {
    this.local_transform!.position![1] =
      1 + Math.sin(elapsed_time * this._speed);
  }
}

async function configureClient(
  instance: LiveLink.LiveLink,
  canvas_element_id: Array<string>
) {
  console.log(canvas_element_id);
  const canvases = await Promise.all(
    canvas_element_id.map(
      async (id) =>
        await new LiveLink.Canvas(instance, {
          canvas_element_id: id,
        }).init()
    )
  );

  for (const canvas of canvases) {
    instance.remote_rendering_surface.addCanvas({ canvas });
  }

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

  // Step 2: decode received frames and draw them on the canvas.
  await instance.installFrameConsumer({
    frame_consumer: new LiveLink.WebCodecsDecoder(
      instance.remote_rendering_surface
    ),
  });

  // Step 3: setup the renderer to use the camera on a full canvas viewport.
  for (const canvas of canvases) {
    const camera = await instance.newEntity(MyCamera, "MyCam");
    const viewport = new LiveLink.Viewport({ camera });
    canvas.attachViewport({ viewport });
  }
  instance.startStreaming();
  instance.startUpdateLoop({ fps: 30 });
}

//------------------------------------------------------------------------------
export default function MultiSession() {
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const instance1 = useRef<LiveLink.LiveLink | null>(null);
  const instance2 = useRef<LiveLink.LiveLink | null>(null);

  useEffect(() => {
    if (!canvasRef1.current || !canvasRef2.current) {
      return;
    }

    async function connect(
      instance: React.MutableRefObject<LiveLink.LiveLink | null>,
      scene_id: string,
      canvas_id: string
    ) {
      instance.current = await LiveLink.LiveLink.join_or_start({
        scene_id,
        token: "public_p54ra95AMAnZdTel",
        session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) =>
          sessions[0],
      });

      await configureClient(instance.current, [canvas_id]);
    }

    connect(
      instance1,
      "e7d69f14-d18e-446b-8df3-cbd24e10fa92",
      canvasRef1.current.id
    );

    connect(
      instance2,
      "15e95136-f9b7-425d-8518-d73dab5589b7",
      canvasRef2.current.id
    );

    return () => {
      instance1.current?.close();
      instance2.current?.close();
    };
  }, [canvasRef1, canvasRef2]);

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

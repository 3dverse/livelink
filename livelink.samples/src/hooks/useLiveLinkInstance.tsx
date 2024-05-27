//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import * as LiveLink from "livelink.js";

//------------------------------------------------------------------------------
export function useLiveLinkInstance({
  canvas_refs,
  scene_id,
  token,
}: {
  canvas_refs: Array<React.RefObject<HTMLCanvasElement>>;
  scene_id: string;
  token: string;
}): {
  instance: LiveLink.LiveLink | null;
  connect: () => Promise<LiveLink.LiveLink | null>;
  disconnect: () => void;
} {
  const [instance, setInstance] = useState<LiveLink.LiveLink | null>(null);

  useEffect(() => {
    return () => {
      instance?.close();
    };
  }, [instance]);

  return {
    instance,
    connect: async () => {
      if (canvas_refs.some((r) => r.current === null)) {
        return null;
      }

      const inst = await connect(
        canvas_refs.map((r) => r.current!.id),
        scene_id,
        token
      );
      setInstance(inst);
      return inst;
    },
    disconnect: () => setInstance(null),
  };
}

//------------------------------------------------------------------------------
async function connect(
  canvas_ids: Array<string>,
  scene_id: string,
  token: string
) {
  const instance = await LiveLink.LiveLink.join_or_start({
    scene_id,
    token,
    session_selector: ({
      sessions,
    }: {
      sessions: Array<LiveLink.SessionInfo>;
    }) => sessions[0],
  });

  await configureClient(instance, canvas_ids);

  return instance;
}

//------------------------------------------------------------------------------
async function configureClient(
  instance: LiveLink.LiveLink,
  canvas_ids: Array<string>
) {
  const canvases = await Promise.all(
    canvas_ids.map(async (canvas_element_id) =>
      new LiveLink.Canvas(instance, {
        canvas_element_id,
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
  let i = 0;
  for (const canvas of canvases) {
    const camera = await instance.newEntity(MyCamera, "MyCam_" + i++);
    const viewport = new LiveLink.Viewport({ camera });
    canvas.attachViewport({ viewport });
  }

  instance.startStreaming();
  instance.startUpdateLoop({ fps: 60 });
}

//------------------------------------------------------------------------------
class MyCamera extends LiveLink.Camera {
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

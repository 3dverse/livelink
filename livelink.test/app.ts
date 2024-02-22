import { UUID, Vec2 } from "@livelink.core";
import { LiveLink } from "livelink.js";

const canvas = document.getElementById("display-canvas")! as HTMLCanvasElement;

const client_config = {
  rendering_area_size: [0, 0] as Vec2,
  encoder_config: {
    codec: 2,
    profile: 1,
    frame_rate: 30,
    lossy: true,
  },
  supported_devices: {
    keyboard: true,
    mouse: true,
    gamepad: true,
    hololens: false,
    touchscreen: false,
  },
  canvas_context: canvas.getContext("2d")!,
};

let first = true;
let timeout = 0;
let camera_rtid = 0n;

const observer = new ResizeObserver((e) => {
  if (LiveLink.instance === null) {
    return;
  }

  const size: Vec2 = [e[0].contentRect.width, e[0].contentRect.height];
  if (timeout !== 0) {
    clearTimeout(timeout);
  }

  timeout = setTimeout(async () => {
    canvas.width = size[0];
    canvas.height = size[1];
    if (first) {
      client_config.rendering_area_size = size;
      await LiveLink.instance!.configureClient({ client_config });
      first = false;
      camera_rtid = await LiveLink.instance!.createDefaultCamera();
    } else {
      LiveLink.instance!.resize({ size });
    }
  }, 500);
});

document.getElementById("scene-selector")!.onchange = (event) => {
  connectToSession((event.target! as HTMLInputElement).value);
};

document.getElementById("connect")!.onclick = () => {
  connectToSession(
    (document.getElementById("scene-selector")! as HTMLInputElement).value
  );
};

document.getElementById("disconnect")!.onclick = disconnectFromCurrentSession;

async function connectToSession(scene_id: UUID) {
  disconnectFromCurrentSession();
  await LiveLink.start({
    scene_id,
    token: "public_p54ra95AMAnZdTel",
  });
  observer.observe(canvas);

  canvas.addEventListener("click", onClick);
}

function disconnectFromCurrentSession() {
  if (LiveLink.instance !== null) {
    observer.unobserve(canvas);
    LiveLink.instance.close();
    first = true;
  }

  canvas.removeEventListener("click", onClick);
}

async function onClick(e: MouseEvent) {
  const x = e.offsetX / canvas.width;
  const y = e.offsetY / canvas.height;
  /*
  const res = await LiveLink.instance.castScreenSpaceRay({
    screenSpaceRayQuery: {
      camera_rtid: BigInt(camera_rtid),
      pos: [x, y],
      mode: 0,
    },
  });

  console.log(res);
  */
}

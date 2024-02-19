const { LiveLink } = await import(
  "http://localhost:3000/livelink.core/dist/livelink.core.js"
);

const canvas = document.getElementById("display-canvas");

const client_config = {
  rendering_area_size: [],
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
  canvas_context: canvas.getContext("2d"),
};

let first = true;
let timeout = null;

const observer = new ResizeObserver((e) => {
  if (LiveLink.instance === null) {
    return;
  }

  const size = [e[0].contentRect.width, e[0].contentRect.height];
  if (timeout !== null) {
    clearTimeout(timeout);
  }

  timeout = setTimeout(async () => {
    canvas.width = size[0];
    canvas.height = size[1];
    if (first) {
      client_config.rendering_area_size = size;
      LiveLink.instance.startStreaming({ client_config });
      first = false;
      await LiveLink.instance.createDefaultCamera();
    } else {
      LiveLink.instance.resize({ size });
    }
  }, 500);
});

document.getElementById("scene-selector").onchange = (event) => {
  connectToSession(event.target.value);
};

document.getElementById("connect").onclick = () => {
  connectToSession(document.getElementById("scene-selector").value);
};

document.getElementById("disconnect").onclick = disconnectFromCurrentSession;

async function connectToSession(scene_id) {
  disconnectFromCurrentSession();
  await LiveLink.start({
    scene_id,
    token: "public_p54ra95AMAnZdTel",
  });
  observer.observe(canvas);
}

function disconnectFromCurrentSession() {
  if (LiveLink.instance !== null) {
    observer.unobserve(canvas);
    LiveLink.instance.close();
    first = true;
  }
}

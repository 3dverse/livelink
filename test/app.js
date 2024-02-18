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

document.getElementById("connect").onclick = async () => {
  await LiveLink.start({
    scene_id: "62b43fa8-528e-4ad9-a5ab-0994c5362529",
    token: "public_p54ra95AMAnZdTel",
  });

  observer.observe(canvas);
};

document.getElementById("disconnect").onclick = () => {
  observer.unobserve(canvas);
  LiveLink.instance.close();
};

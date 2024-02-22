import {
  ClientConfig,
  CodecType,
  EncodingProfile,
} from "../livelink.core/_prebuild/types";
import { Canvas, Camera, LiveLink, Viewport } from "../livelink.js/sources";

export async function InitializeApp() {
  await LiveLink.start({
    scene_id: "",
    token: "",
  });

  const canvas = new Canvas({
    canvas_element_id: "display-canvas",
    viewports: [
      //new Viewport({ camera: await LiveLink.instance.getEntity() }),
      new Viewport({
        camera: await Camera.create({ context: LiveLink.instance }),
      }),
    ],
  });

  const client_config: ClientConfig = {
    rendering_area_size: canvas.dimensions,
    encoder_config: {
      codec: CodecType.h264,
      profile: EncodingProfile.base,
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
    canvas_context: new CanvasRenderingContext2D(),
  };

  LiveLink.instance.startStreaming({ client_config });

  //const camera = new Camera();
  //camera.perspective_lens.fov = 45;
  //camera.local_transform.position = [0, 0, 5];
  //LiveLink.instance.createEntity(camera);

  //const camera = await LiveLink.instance.createEntity();

  //const camera = await Entity.create<Camera>({ context: LiveLink.instance });

  // 1. Establish the connection with the cluster gateway
  // 2. Send the authentication request
  // 3. Wait for the authentication response
  // 4. Setup client config (encoder and canvas size)
  // 5. Wait for the client config confirmation
  // 6. Start the decoder
}

import { UUID, Vec2, Vec3 } from "@livelink.core";
import { Camera, Canvas, LiveLink, Viewport } from "livelink.js";

class ControlPanel {
  private _instance: LiveLink | null = null;
  private _canvas: Canvas | null = null;
  private _camera: Camera | null = null;

  /**
   *
   */
  constructor(public readonly id: string) {
    this._canvas = new Canvas({
      canvas_element_id: "display-canvas-" + id,
      viewports: [],
    });

    document.getElementById("scene-selector-" + id)!.onchange = async () =>
      await this._connectToSession();

    document.getElementById("connect-" + id)!.onclick = async () =>
      await this._connectToSession();

    document.getElementById("disconnect-" + id)!.onclick = () =>
      this._disconnectFromCurrentSession();
  }

  /**
   *
   */
  private get scene_id(): UUID {
    return (
      document.getElementById("scene-selector-" + this.id)! as HTMLInputElement
    ).value;
  }

  /**
   *
   */
  private async _connectToSession() {
    this._disconnectFromCurrentSession();

    this._instance = await LiveLink.start({
      scene_id: this.scene_id,
      token: "public_p54ra95AMAnZdTel",
    });

    await this._configureClient();

    this._canvas!.addEventListener("on-resized", this._onCanvasResized);
  }

  /**
   *
   */
  private _onCanvasResized = (e: Event) => {
    const event = e as CustomEvent;
    this._instance!.resize({ size: event.detail.new_size });
  };

  /**
   *
   */
  private async _configureClient() {
    const client_config = {
      rendering_area_size: [this._canvas!.width, this._canvas!.height] as Vec2,
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
      canvas_context: this._canvas!.html_element.getContext("2d")!,
    };

    await this._instance!.configureClient({ client_config });

    const components = {
      camera: {
        renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
        dataJSON: { grid: true, skybox: false, gradient: true },
      },
      perspective_lens: {},
      local_transform: { position: [0, 2, 5] as Vec3 },
      debug_name: { value: "MyCam" },
    };

    this._camera = await this._instance!.createCamera({
      components,
    });

    this._canvas!.attachViewport({
      viewport: new Viewport({ camera: this._camera }),
    });
    this._instance!.setViewports({ viewports: this._canvas!.viewports });
    this._instance!.resume();
    this._canvas!.html_element.addEventListener("click", this._onClick);
  }

  /**
   *
   */
  private _disconnectFromCurrentSession() {
    if (this._instance !== null) {
      this._instance.close();
      this._instance = null;
      this._canvas!.html_element.removeEventListener("click", this._onClick);
      this._canvas!.removeEventListener("on-resized", this._onCanvasResized);
    }
  }

  /**
   *
   */
  private _onClick = async (ev: Event) => {
    const e = ev as MouseEvent;
    console.log(this);

    const x = e.offsetX / this._canvas!.width;
    const y = e.offsetY / this._canvas!.height;

    console.log("Picking", [x, y]);
    const res = await this._camera!.castScreenSpaceRay({ pos: [x, y] });
    console.log(res);
  };
}

const cp1 = new ControlPanel("1");
const cp2 = new ControlPanel("2");

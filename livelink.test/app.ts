import { RTID, UUID, Vec2 } from "@livelink.core";
import { Canvas, LiveLink } from "livelink.js";

class ControlPanel {
  private _instance: LiveLink | null = null;
  private _canvas: Canvas | null = null;
  private _camera_rtid: RTID = 0n;

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

    this._canvas!.addEventListener("on-resized", (e: Event) => {
      const event = e as CustomEvent;
      this._onCanvasResized(event.detail.new_size);
    });

    //this._canvas!.addEventListener("click", (e) => this._onClick(e));
  }

  /**
   *
   */
  private _onCanvasResized(new_size: Vec2) {
    if (this._instance !== null) {
      console.log("RESIZING!", new_size);
      this._instance!.resize({ size: new_size });
    }
  }

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

    this._camera_rtid = await this._instance!.createDefaultCamera();
  }

  /**
   *
   */
  private _disconnectFromCurrentSession() {
    if (this._instance !== null) {
      this._instance.close();
      this._instance = null;
    }

    //this._canvas!.removeEventListener("click", (e) => this._onClick(e));
  }

  /*
  private async _onClick(e: MouseEvent) {
    const x = e.offsetX / this._canvas!.width;
    const y = e.offsetY / this._canvas!.height;
    console.log("Picking", [x, y]);

    const res = await this._instance!.castScreenSpaceRay({
      screenSpaceRayQuery: {
        camera_rtid: BigInt(this._camera_rtid),
        pos: [x, y],
        mode: 0,
      },
    });

    console.log(res);
  }
  */
}

const cp1 = new ControlPanel("1");
const cp2 = new ControlPanel("2");

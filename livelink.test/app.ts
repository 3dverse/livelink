import {
  ClientConfig,
  Entity,
  HighlightMode,
  UUID,
  Vec2,
} from "@livelink.core";
import {
  Camera,
  Canvas,
  LiveLink,
  Viewport,
  WebCodecsDecoder,
} from "livelink.js";

/**
 *
 */
class ControlPanel {
  private _instance: LiveLink | null = null;
  private _canvas: Canvas | null = null;
  private _camera: Camera | null = null;
  private _animation_interval: number = 0;

  /**
   *
   */
  constructor(public readonly id: string) {
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

    this._animation_interval = setInterval(() => this._animate(), 30);
    //this._instance.startUpdateLoop();

    this._canvas!.addEventListener("on-resized", this._onCanvasResized);
  }

  /**
   *
   */
  private _onCanvasResized = (e: Event) => {
    this._instance!.resize({ size: this._canvas!.remote_canvas_size });
  };

  /**
   *
   */
  private async _configureClient() {
    this._canvas = await new Canvas({
      canvas_element_id: "display-canvas-" + this.id,
    }).init();

    const client_config: ClientConfig = {
      remote_canvas_size: this._canvas.remote_canvas_size,
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
    };

    // Step 1: configure the client on the renderer side, this informs the
    //         renderer on the client canvas size and available input devices
    //         and most importantly activates the session.
    await this._instance!.configureClient({ client_config });

    // Step 1': get or create a camera to render frames (not dependent on
    //          anything)
    this._camera = await this._getCamera();
    if (this._camera === null) {
      await this._createCamera();
    }

    // Step 2: create a local decoder
    await this._instance!.configureDecoder(WebCodecsDecoder, {
      frame_size: this._canvas.remote_canvas_size,
      canvas_context: this._canvas.html_element.getContext("2d")!,
    });

    // Step 3: setup the renderer to use the camera on a full canvas viewport.
    this._canvas!.attachViewport({
      viewport: new Viewport({ camera: this._camera! }),
    });
    this._instance!.setViewports({ viewports: this._canvas.viewports });
    this._instance!.resume();
    this._canvas!.addEventListener("on-clicked", this._onClick);
  }

  /**
   *
   */
  private async _getCamera(): Promise<Camera | null> {
    const entity_uuid = "415e4e93-5d60-4ca9-b21f-5fc69b897c3c";
    return await this._instance!.findEntity(Camera, { entity_uuid });
  }

  /**
   *
   */
  private async _createCamera() {
    this._camera = this._instance!.newEntity(Camera, "MyCam");
    this._camera.camera = {
      renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
      dataJSON: { grid: true, skybox: false, gradient: true },
    };
    this._camera.perspective_lens = {};
    this._camera.local_transform = { position: [0, 1, 5] };

    await this._camera.instantiate();
    //this._instance!.instantiateEntity({entity:this._camera});
    //this._instance!.instantiateEntities({entities:[this._camera]});
  }

  static t = 0;
  /**
   *
   */
  _animate() {
    this._camera!.local_transform!.position![1] = 1 + Math.sin(ControlPanel.t);

    ControlPanel.t += 0.033;
    //(camera.camera!.dataJSON as { grid: boolean }).grid = false;
  }

  /**
   *
   */
  private _disconnectFromCurrentSession() {
    if (this._instance !== null) {
      this._instance.close();
      this._instance = null;
    }

    if (this._canvas !== null) {
      this._canvas!.removeEventListener("on-clicked", this._onClick);
      this._canvas!.removeEventListener("on-resized", this._onCanvasResized);
    }

    if (this._animation_interval !== 0) {
      clearInterval(this._animation_interval);
      this._animation_interval = 0;
    }
  }

  /**
   *
   */
  private _onClick = async (ev: Event) => {
    const e = ev as CustomEvent;

    console.log("Picking", e.detail.relative_pos);
    const res = await this._camera!.castScreenSpaceRay({
      pos: e.detail.relative_pos,
      mode: 2,
    });
    console.log(res);

    this._instance!.highlightEntities({
      highlightEntitiesQuery: {
        entities: res.entity_rtid === 0n ? [] : [res.entity_rtid],
        keep_old_selection: false,
      },
    });
  };
}

const cp1 = new ControlPanel("1");
const cp2 = new ControlPanel("2");

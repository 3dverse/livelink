import { ClientConfig, UUID } from "@livelink.core";
import { Canvas, LiveLink, SoftwareDecoder, Viewport, WebCodecsDecoder } from "livelink.js";
import { MyCamera, MyTrigger } from "./EntityDefs";
import { VideoWriter } from "./VideoWriter";

/**
 *
 */
class ControlPanel {
    private _instance: LiveLink | null = null;
    private _canvas: Canvas | null = null;
    private _camera: MyCamera | null = null;
    private _viewport: Viewport | null = null;

    /**
     *
     */
    constructor(public readonly id: string) {
        document.getElementById("scene-selector-" + id)!.onchange = async () => await this._connectToSession();

        document.getElementById("connect-" + id)!.onclick = async () => await this._connectToSession();

        document.getElementById("disconnect-" + id)!.onclick = () => this._disconnectFromCurrentSession();
    }

    /**
     *
     */
    private get scene_id(): UUID {
        return (document.getElementById("scene-selector-" + this.id)! as HTMLInputElement).value;
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

        this._instance.startUpdateLoop({ fps: 60 });
    }

    /**
     *
     */
    private async _configureClient() {
        this._canvas = await new Canvas(this._instance!, {
            canvas_element_id: "display-canvas-" + this.id,
        }).init();

        this._instance!.remote_rendering_surface.addCanvas({
            canvas: this._canvas,
        });

        const client_config: ClientConfig = {
            remote_canvas_size: this._instance!.remote_rendering_surface.dimensions,
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
        await this._instance!.configureClient({ client_config });

        // Step 1': get or create a camera to render frames (not dependent on
        //          anything)
        this._camera = (await this._getCamera()) ?? (await this._createCamera());

        // Step 2: decode received frames and draw them on the canvas.
        await this._instance!.installFrameConsumer({
            //frame_consumer: new VideoWriter(),
            frame_consumer: new WebCodecsDecoder(this._instance!.remote_rendering_surface),
            //frame_consumer: new SoftwareDecoder(
            //  this._instance!.remote_rendering_surface
            //),
        });

        // Step 3: setup the renderer to use the camera on a full canvas viewport.
        this._viewport = new Viewport({ camera: this._camera });
        this._canvas.attachViewport({ viewport: this._viewport });
        this._instance!.startStreaming();
        this._viewport.addEventListener("on-clicked", this._onClick);
    }

    /**
     *
     */
    private async _getCamera(): Promise<MyCamera | null> {
        //const entity_uuid = "415e4e93-5d60-4ca9-b21f-5fc69b897c3c";
        const entity_uuid = "f28e67f7-8ba4-4386-9917-dd66ed2c2fcc";
        return await this._instance!.findEntity(MyCamera, { entity_uuid });
    }

    /**
     *
     */
    private async _createCamera(): Promise<MyCamera> {
        return await this._instance!.newEntity(MyCamera, "MyCam");
        //this._instance!.instantiateEntity({entity:this._camera});
        //this._instance!.instantiateEntities({entities:[this._camera]});
    }

    /**
     *
     */
    private _disconnectFromCurrentSession() {
        if (this._instance !== null) {
            this._instance.close();
            this._instance = null;
        }

        if (this._viewport !== null) {
            this._viewport!.removeEventListener("on-clicked", this._onClick);
        }
    }

    /**
     *
     */
    private _onClick = async (ev: Event) => {
        const e = ev as CustomEvent;

        console.log("Picking", e.detail.relative_pos);
        const res = await this._canvas!.castScreenSpaceRay({
            pos: e.detail.relative_pos,
            mode: 2,
        });

        console.log(res);

        if (!res) {
            return;
        }

        this._instance!.highlightEntities({
            highlightEntitiesMessage: {
                entities: res.entity_rtid === 0n ? [] : [res.entity_rtid],
                keep_old_selection: false,
            },
        });
    };
}

const cp1 = new ControlPanel("1");
const cp2 = new ControlPanel("2");

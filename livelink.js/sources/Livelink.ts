import {
    LivelinkCore,
    Session,
    ClientConfig,
    SessionInfo,
    UUID,
    SessionSelector,
    FrameData,
    CodecType,
    Entity,
    Scene,
    ClientConfigResponse,
} from "@livelink.core";

import type { EncodedFrameConsumer } from "./decoders/EncodedFrameConsumer";
import { RemoteRenderingSurface } from "./RemoteRenderingSurface";
import { Camera } from "./Camera";
import { Viewport } from "./Viewport";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";

/**
 * The Livelink interface.
 *
 * This interface CAN be embedded and distributed inside applications.
 */
export class Livelink extends LivelinkCore {
    /**
     * Start a session with the given scene id
     *
     * @param {Object}  obj
     * @param {UUID}    obj.scene_id  The id of the scene to start
     * @param {string}  obj.token     The public access token or the user token
     *                                which must have at least read access to the
     *                                scene
     *
     * @returns {Promise<Livelink>}   A promise to a Livelink instance holding a
     *                                session with the specified scene
     *
     * @throws {Error} Session issues
     * @throws {Error} Gateway issues
     * @throws {Error} SEB issues
     */
    static async start({ scene_id, token }: { scene_id: UUID; token: string }): Promise<Livelink> {
        console.debug(`Starting new session on scene '${scene_id}'`);
        const session = await new Session(scene_id, token).create();
        return await Livelink.join({ session });
    }

    /**
     *
     */
    static async join_or_start({
        scene_id,
        token,
        session_selector = ({ sessions }: { sessions: Array<SessionInfo> }) => sessions[0],
    }: {
        scene_id: UUID;
        token: string;
        session_selector: SessionSelector;
    }): Promise<Livelink> {
        console.debug(`Looking for sessions on scene '${scene_id}'`);
        const session = await new Session(scene_id, token).find({
            session_selector,
        });

        if (session === null) {
            console.debug(
                `There's no session currently running on scene '${scene_id}' and satisfiying the provided selector criteria`,
            );
            return await Livelink.start({ scene_id, token });
        }

        try {
            console.debug("Found session, joining...", session);
            return await Livelink.join({ session });
        } catch {
            console.error(`Failed to join session '${session.session_id}', trying again with another session.`);

            return await Livelink.join_or_start({
                scene_id,
                token,
                // Do not try to connect to the faulty session again.
                session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) => {
                    sessions = sessions.filter(s => s.session_id !== session.session_id);
                    return sessions.length === 0 ? null : session_selector({ sessions });
                },
            });
        }
    }

    /**
     *
     */
    static async join({ session }: { session: Session }): Promise<Livelink> {
        console.debug("Joining session:", session);
        const inst = new Livelink(session);
        await inst._connect();
        return inst;
    }

    /**
     * The codec used by the renderer.
     */
    private _codec: CodecType | null = null;
    /**
     *
     */
    private _remote_rendering_surface = new RemoteRenderingSurface(this);
    /**
     * User provided frame consumer designed to handle encoded frames from the
     * remote viewer.
     */
    private _encoded_frame_consumer: EncodedFrameConsumer | null = null;

    /**
     *
     */
    get default_decoded_frame_consumer(): DecodedFrameConsumer {
        return this._remote_rendering_surface;
    }

    /**
     *
     */
    private constructor(public readonly session: Session) {
        super(session);
    }

    /**
     *
     */
    async disconnect() {
        if (this._encoded_frame_consumer) {
            this._encoded_frame_consumer.release();
        }

        this._remote_rendering_surface.release();

        await super.disconnect();
    }

    /**
     *
     */
    addViewports({ viewports }: { viewports: Array<Viewport> }) {
        this._remote_rendering_surface.addViewports({ viewports });
    }

    /**
     *
     */
    async configureRemoteServer({ codec }: { codec: CodecType }): Promise<ClientConfigResponse> {
        const client_config: ClientConfig = {
            remote_canvas_size: this._remote_rendering_surface.dimensions,
            encoder_config: {
                codec,
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

        const res = await this.configureClient({ client_config });
        this._codec = res.codec;
        return res;
    }

    /**
     *
     */
    isConfigured(): boolean {
        return this._codec !== null;
    }

    /**
     *
     */
    async installFrameConsumer({ frame_consumer }: { frame_consumer: EncodedFrameConsumer }) {
        if (this._codec === null) {
            throw new Error("Client not configured.");
        }

        this._encoded_frame_consumer = await frame_consumer.configure({
            codec: this._codec,
            frame_dimensions: this._remote_rendering_surface.dimensions,
        });
    }

    /**
     *
     */
    protected onFrameReceived = ({ frame_data }: { frame_data: FrameData }) => {
        this._encoded_frame_consumer!.consumeEncodedFrame({
            encoded_frame: frame_data.encoded_frame,
        });
    };

    /**
     *
     */
    startStreaming() {
        if (!this.isConfigured()) {
            throw new Error("The Livelink instance is not configured yet");
        }

        this._remote_rendering_surface.init();
        this.resume();
        this.startUpdateLoop({});
    }

    /**
     *
     */
    async newCamera<CameraType extends Camera>(
        camera_type: { new (_: Scene): CameraType },
        name: string,
        viewport: Viewport,
    ): Promise<CameraType> {
        let camera = new camera_type(this.scene).init(name);
        camera = new Proxy(camera, Entity.handler) as CameraType;
        viewport.camera = camera;
        camera.viewport = viewport;
        camera.auto_update = "off";
        camera.onCreate();
        camera.auto_update = "on";
        await camera.instantiate();
        return camera;
    }
}

import {
    ClientConfig,
    ClientConfigResponse,
    CodecType,
    EntityUpdatedEvent,
    FrameData,
    FrameMetaData,
    InputState,
    LivelinkCore,
    LivelinkCoreModule,
    Quat,
    RTID,
    ScreenSpaceRayQuery,
    ScreenSpaceRayResult,
    UUID,
    Vec2i,
    ViewportConfigs,
} from "@3dverse/livelink.core";

import { EncodedFrameConsumer } from "./decoders/EncodedFrameConsumer";
import { CameraFrameTransform } from "./decoders/CameraFrameTransform";
import { RawFrameMetaData } from "./decoders/RawFrameMetaData";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";
import { RemoteRenderingSurface } from "./surfaces/RemoteRenderingSurface";
import { Session, SessionInfo, SessionSelector } from "./Session";
import { InputDevice } from "./inputs/InputDevice";
import { Viewport } from "./Viewport";
import { Camera } from "./Camera";
import { Entity } from "./Entity";
import { Scene } from "./Scene";
import { getWorldPosition, getWorldQuaternion } from "./utils";

/**
 * The Livelink interface.
 *
 * This interface CAN be embedded and distributed inside applications.
 */
export class Livelink {
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
        session_selector?: SessionSelector;
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
        await LivelinkCoreModule.init();

        console.debug("Joining session:", session);
        const inst = new Livelink({ session });
        await inst.#connect();
        return inst;
    }

    /**
     *
     */
    public readonly session: Session;

    /**
     *
     */
    public readonly scene: Scene;

    /**
     *
     */
    #core: LivelinkCore;

    /**
     * The codec used by the renderer.
     */
    #codec: CodecType | null = null;
    /**
     *
     */
    #remote_rendering_surface = new RemoteRenderingSurface(this);

    /**
     * User provided frame consumer designed to handle encoded frames from the
     * remote viewer.
     */
    #encoded_frame_consumer: EncodedFrameConsumer | null = null;

    /**
     * List of input devices.
     */
    #input_devices: Array<InputDevice> = [];

    /**
     * Interval between update to the renderer.
     */
    #update_interval = 0;

    /**
     * Interval between broadcasts to the editor.
     */
    #broadcast_interval = 0;

    /**
     *
     */
    get default_decoded_frame_consumer(): DecodedFrameConsumer {
        return this.#remote_rendering_surface;
    }

    /**
     *
     */
    private constructor({ session }: { session: Session }) {
        this.session = session;
        this.#core = new LivelinkCoreModule.Core();
        this.scene = new Scene(this.#core);
    }

    /**
     *
     */
    async #connect(): Promise<Livelink> {
        // Retrieve a session key
        await this.session.registerClient();

        const component_serializer = await this.#core.connect({ session: this.session, editor_url: EDITOR_URL });
        this.scene.entity_registry._configureComponentSerializer({ component_serializer });

        this.#core.addEventListener({
            target: "editor",
            event_name: "entities-updated",
            handler: (event: Event) => {
                const e = event as CustomEvent<Record<UUID, EntityUpdatedEvent>>;
                for (const entity_euid in e.detail) {
                    this.scene.entity_registry._updateEntityFromEvent({
                        entity_euid,
                        updated_components: e.detail[entity_euid].updatedComponents,
                    });
                }
            },
        });

        this.#core.addEventListener({
            target: "gateway",
            event_name: "on-script-event-received",
            handler: this.scene._onScriptEventReceived,
        });

        this.#core.addEventListener({
            target: "gateway",
            event_name: "on-frame-received",
            handler: this.#onFrameReceived,
        });

        return this;
    }

    /**
     *
     */
    async disconnect() {
        this.#core.removeEventListener({
            target: "gateway",
            event_name: "on-script-event-received",
            handler: this.scene._onScriptEventReceived,
        });

        this.#core.removeEventListener({
            target: "gateway",
            event_name: "on-frame-received",
            handler: this.#onFrameReceived,
        });

        if (this.#update_interval !== 0) {
            clearInterval(this.#update_interval);
        }

        if (this.#broadcast_interval !== 0) {
            clearInterval(this.#broadcast_interval);
        }

        if (this.#encoded_frame_consumer !== null) {
            this.#encoded_frame_consumer.release();
        }

        await this.session.close();

        this.#remote_rendering_surface.release();
        this.#input_devices.forEach(d => d.teardown());

        await this.#core.disconnect();
    }

    /**
     *
     */
    addViewports({ viewports }: { viewports: Array<Viewport> }): void {
        this.#remote_rendering_surface.addViewports({ viewports });
    }

    /**
     *
     */
    removeViewport({ viewport }: { viewport: Viewport }): void {
        this.#remote_rendering_surface.removeViewport({ viewport });
    }

    /**
     *
     */
    get viewports(): Array<Viewport> {
        return this.#remote_rendering_surface.viewports;
    }

    /**
     *
     */
    async configureRemoteServer({
        codec = LivelinkCoreModule.Enums.CodecType.h264,
    }: {
        codec?: CodecType;
    }): Promise<ClientConfigResponse> {
        const client_config: ClientConfig = {
            remote_canvas_size: this.#remote_rendering_surface.dimensions,
            encoder_config: { codec, profile: 1, frame_rate: 60, lossy: true },
            supported_devices: { keyboard: true, mouse: true, gamepad: true, hololens: false, touchscreen: false },
        };

        const res = await this.#core.configureClient({ client_config });
        this.#codec = res.codec;
        return res;
    }

    /**
     *
     */
    isConfigured(): boolean {
        return this.#codec !== null;
    }

    /**
     *
     */
    async installFrameConsumer({ frame_consumer }: { frame_consumer: EncodedFrameConsumer }): Promise<void> {
        if (this.#codec === null) {
            throw new Error("Client not configured.");
        }

        this.#encoded_frame_consumer = await frame_consumer.configure({
            codec: this.#codec,
            frame_dimensions: this.#remote_rendering_surface.dimensions,
        });
    }

    /**
     *
     */
    #onFrameReceived = (e: Event) => {
        const frame_data = (e as CustomEvent<FrameData>).detail;

        this.session._updateClients({ client_data: frame_data.meta_data.clients });
        const meta_data = this.#parseFrameMetaData(frame_data.meta_data);
        this.#encoded_frame_consumer!.consumeEncodedFrame({ encoded_frame: frame_data.encoded_frame, meta_data });
    };

    /**
     *
     */
    #parseFrameMetaData(frame_meta_data: FrameMetaData): RawFrameMetaData {
        const meta_data: RawFrameMetaData = {
            renderer_timestamp: frame_meta_data.renderer_timestamp,
            frame_counter: frame_meta_data.frame_counter,
            current_client_cameras: [],
            other_clients_cameras: [],
        };

        for (const client of frame_meta_data.clients) {
            for (const viewport of client.viewports) {
                const camera = this.scene.entity_registry.get({ entity_rtid: viewport.camera_rtid }) as Camera | null;
                if (!camera) {
                    continue;
                }
                const cameraMetadata: CameraFrameTransform = {
                    camera,
                    position: getWorldPosition(viewport.ws_from_ls),
                    orientation: getWorldQuaternion(viewport.ws_from_ls),
                };

                if (client.client_id === this.session.client_id) {
                    meta_data.current_client_cameras.push(cameraMetadata);
                } else {
                    meta_data.other_clients_cameras.push(cameraMetadata);
                }
            }
        }
        return meta_data;
    }

    /**
     *
     */
    startStreaming() {
        if (!this.isConfigured()) {
            throw new Error("The Livelink instance is not configured yet");
        }

        this.#remote_rendering_surface.init();
        this.#core.resume();
        this.#startUpdateLoop({});
    }

    /**
     *
     */
    async newCamera<CameraType extends Camera>(
        camera_type: { new (_s: Scene): CameraType },
        name: string,
        viewport: Viewport,
    ): Promise<CameraType> {
        let camera = new camera_type(this.scene).init(name);
        camera = new Proxy(camera, Entity.handler) as CameraType;
        viewport.camera = camera;
        await camera._instantiate({ delete_on_client_disconnection: true });
        return camera;
    }

    /**
     *
     */
    refreshViewports() {
        this.#remote_rendering_surface.init();
    }

    /**
     *
     */

    addInputDevice<DeviceType extends InputDevice>(
        device_type: { new (_: Livelink, viewport?: Viewport): DeviceType },
        viewport?: Viewport,
    ) {
        const device = new device_type(this, viewport);
        device.setup();
        this.#input_devices.push(device);
    }

    /**
     *
     */
    removeInputDevice({ device_name }: { device_name: string }) {
        const device = this.#input_devices.find(d => d.name === device_name);
        if (!device) {
            throw new Error(`Input device with name '${device_name}' not found`);
        }
        device.teardown();
        this.#input_devices = this.#input_devices.filter(d => d.name !== device_name);
    }

    /**
     *
     */
    startSimulation(): void {
        this.#core.setSimulationState({ state: "start_simulation" });
    }

    /**
     *
     */
    #startUpdateLoop({
        updatesPerSecond = 30,
        broadcastsPerSecond = 1,
    }: {
        updatesPerSecond?: number;
        broadcastsPerSecond?: number;
    }) {
        this.#update_interval = setInterval(() => {
            this.scene.entity_registry.advanceFrame({ dt: 1 / updatesPerSecond });

            const updateMsg = this.scene.entity_registry._getEntitiesToUpdate();
            if (updateMsg !== null) {
                this.#core.updateEntitiesFromJson(updateMsg);
                this.scene.entity_registry._clearUpdateList();
            }

            const detachMsg = this.scene.entity_registry._getComponentsToDetach();
            if (detachMsg !== null) {
                this.#core.removeComponents(detachMsg);
                this.scene.entity_registry._clearDetachList();
            }
        }, 1000 / updatesPerSecond);

        this.#broadcast_interval = setInterval(() => {
            const msg = this.scene.entity_registry._getEntitiesToBroadcast();
            if (msg !== null) {
                this.#core.updateComponents(msg);
                this.scene.entity_registry._clearBroadcastList();
            }
        }, 1000 / broadcastsPerSecond);
    }

    /**
     *
     */
    sendSkeletonPose({ controller, pose }: { controller: Entity; pose: Map<number, Quat> }): void {
        this.#core.sendSkeletonPose({
            controller_rtid: controller.rtid!,
            pose,
        });
    }

    /**
     *
     */
    _sendInput({ input_state }: { input_state: InputState }) {
        this.#core.sendInputState({ input_state });
    }

    /**
     *
     */
    _resize({ size }: { size: Vec2i }) {
        this.#core.resize({ size });
    }

    /**
     *
     */
    _setViewports({ viewport_configs }: { viewport_configs: ViewportConfigs }): void {
        this.#core.setViewports({ viewport_configs });
    }

    /**
     *
     */
    async _castScreenSpaceRay({
        screenSpaceRayQuery,
    }: {
        screenSpaceRayQuery: ScreenSpaceRayQuery;
    }): Promise<ScreenSpaceRayResult> {
        return this.#core.castScreenSpaceRay({ screenSpaceRayQuery });
    }

    /**
     *
     */
    _updateAnimationSequenceState(params: {
        linker_rtid: RTID;
        animation_sequence_id: UUID;
        state: 1 | 0;
        playback_speed: number;
        seek_offset?: number;
    }): void {
        this.#core.updateAnimationSequenceState(params);
    }
}

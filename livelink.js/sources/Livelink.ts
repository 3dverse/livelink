import type {
    ClientConfig,
    ClientConfigResponse,
    CodecType,
    EntityUpdatedEvent,
    FrameData,
    InputState,
    LivelinkCore,
    RTID,
    ScreenSpaceRayQuery,
    ScreenSpaceRayResult,
    SkeletonPartialPose,
    UUID,
    Vec2i,
    ViewportConfigs,
} from "@3dverse/livelink.core";

import { LivelinkCoreModule } from "@3dverse/livelink.core";

import { rawFrameMetaDatafromFrameMetaData } from "./decoders/RawFrameMetaData";
import { EncodedFrameConsumer } from "./decoders/EncodedFrameConsumer";
import { DecodedFrameConsumer } from "./decoders/DecodedFrameConsumer";

import { RemoteRenderingSurface } from "./surfaces/RemoteRenderingSurface";

import { Session, SessionInfo, SessionSelector } from "./Session";

import { InputDevice } from "./inputs/InputDevice";
import { Viewport } from "./Viewport";
import { Camera } from "./Camera";
import { Entity } from "./Entity";
import { Scene } from "./Scene";
import { compute_rpn } from "./Filters";

/**
 * The Livelink interface.
 *
 * This interface CAN be embedded and distributed inside applications.
 *
 * @category Core
 */
export class Livelink {
    /**
     * @internal
     */
    static _api_url = `https://${API_HOSTNAME}/app/v1`;

    /**
     * @internal
     */
    static _editor_url = EDITOR_URL;

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
    static async start({
        scene_id,
        token,
        is_transient,
    }: {
        scene_id: UUID;
        token: string;
        is_transient?: boolean;
    }): Promise<Livelink> {
        console.debug(`Starting new session on scene '${scene_id}'`);
        const session = await Session.create({ scene_id, token, is_transient });
        return await Livelink.join({ session });
    }

    /**
     *
     */
    static async join_or_start({
        scene_id,
        token,
        session_selector = ({ sessions }: { sessions: Array<SessionInfo> }) => sessions[0],
        is_transient,
    }: {
        scene_id: UUID;
        token: string;
        session_selector?: SessionSelector;
        is_transient?: boolean;
    }): Promise<Livelink> {
        console.debug(`Looking for sessions on scene '${scene_id}'`);
        const session = await Session.find({ scene_id, token, session_selector });

        if (session === null) {
            console.debug(
                `There's no session currently running on scene '${scene_id}' and satisfiying the provided selector criteria`,
            );
            return await Livelink.start({ scene_id, token, is_transient });
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
        return new Livelink({ session }).#connect();
    }

    /**
     * The session associated with this Livelink instance.
     */
    public readonly session: Session;

    /**
     * The scene the current session is running.
     */
    public readonly scene: Scene;

    /**
     * The core object holding the connection to the server.
     */
    #core: LivelinkCore;

    /**
     * The codec used by the renderer.
     */
    #codec: CodecType | null = null;

    /**
     * The rendering surface as seen by the renderer.
     */
    #remote_rendering_surface = new RemoteRenderingSurface(this);

    /**
     * User provided frame consumer designed to receive the encoded frames sent by the renderer.
     */
    #encoded_frame_consumer: EncodedFrameConsumer | null = null;

    /**
     * List of active input devices.
     */
    #input_devices: Array<InputDevice> = [];

    /**
     * Interval between updates to the renderer.
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
     * Activity watcher.
     */
    get activity_watcher() {
        return this.#core.activity_watcher;
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

        const { component_descriptors, settings, serializer } = await this.#core.connect({
            session: this.session,
            editor_url: Livelink._editor_url,
        });

        this.scene.entity_registry._configureComponentDefaultValues({ component_descriptors });
        this.scene.entity_registry._configureComponentSerializer({ serializer });

        this.scene.settings._init(settings);

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
            target: "editor",
            event_name: "entity-visibility-changed",
            handler: e => {
                const event = e as CustomEvent<{ entityRTID: RTID; isVisible: boolean }>;
                this.scene._onEntityVisibilityChanged({
                    entity_rtid: event.detail.entityRTID,
                    is_visible: event.detail.isVisible,
                });
            },
        });

        this.#core.addEventListener({
            target: "gateway",
            event_name: "on-script-event-received",
            handler: e => this.scene._onScriptEventReceived(e),
        });

        this.#core.addEventListener({
            target: "gateway",
            event_name: "on-frame-received",
            handler: this.#onFrameReceived,
        });

        this.#core.addEventListener({
            target: "gateway",
            event_name: "on-disconnected",
            handler: e => this.session._onDisconnected(e),
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
            handler: e => this.scene._onScriptEventReceived(e),
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
        this.#input_devices.forEach(d => d.release());

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
            remote_canvas_size: this.#remote_rendering_surface.computeRemoteCanvasSize({ codec }),
            encoder_config: { codec, profile: 1, frame_rate: 60, lossy: true },
            supported_devices: { keyboard: true, mouse: true, gamepad: true, hololens: false, touchscreen: false },
        };

        console.debug("Initial surface size", this.#remote_rendering_surface.dimensions);
        const res = await this.#core.configureClient({ client_config });

        this.#codec = res.codec;
        return res;
    }

    /**
     * @experimental
     */
    async configureHeadlessClient(): Promise<ClientConfigResponse> {
        const client_config: ClientConfig = {
            remote_canvas_size: [8, 8],
            encoder_config: { codec: LivelinkCoreModule.Enums.CodecType.h264, profile: 1, frame_rate: 30, lossy: true },
            supported_devices: {
                keyboard: true,
                mouse: false,
                gamepad: false,
                hololens: false,
                touchscreen: false,
            },
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
    async setEncodedFrameConsumer({
        encoded_frame_consumer,
    }: {
        encoded_frame_consumer: EncodedFrameConsumer;
    }): Promise<void> {
        if (this.#codec === null) {
            throw new Error("Client not configured.");
        }

        this.#encoded_frame_consumer = await encoded_frame_consumer.configure({
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
        const meta_data = rawFrameMetaDatafromFrameMetaData({
            frame_meta_data: frame_data.meta_data,
            client_id: this.session.client_id!,
            entity_registry: this.scene.entity_registry,
        });

        for (const frame_camera_transform of meta_data.current_client_cameras) {
            frame_camera_transform.camera.updateClipFromWorldMatrix({ frame_camera_transform });
        }

        this.#encoded_frame_consumer!.consumeEncodedFrame({ encoded_frame: frame_data.encoded_frame, meta_data });
    };

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
        camera.onCreate();
        camera.updateLens();

        await camera._instantiate(
            this.#core.spawnEntity({ entity: camera, options: { delete_on_client_disconnection: true } }),
        );

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
        device.release();
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
    pauseSimulation(): void {
        this.#core.setSimulationState({ state: "pause_simulation" });
    }

    /**
     *
     */
    stopSimulation(): void {
        this.#core.setSimulationState({ state: "stop_simulation" });
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
                if (updateMsg.binary) {
                    this.#core.updateEntitiesFromBytes(updateMsg.message);
                } else {
                    this.#core.updateEntitiesFromJson(updateMsg.message);
                }
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
    sendSkeletonPose({ controller, partial_pose }: { controller: Entity; partial_pose: SkeletonPartialPose }): void {
        this.#core.sendSkeletonPose({
            controller_rtid: controller.rtid!,
            partial_pose,
        });
    }

    /**
     * @internal
     */
    _sendInput({ input_state }: { input_state: InputState }) {
        this.#core.sendInputState({ input_state });
    }

    /**
     * @internal
     */
    _resize({ size }: { size: Vec2i }) {
        this.#core.resize({ size });
    }

    /**
     * @internal
     */
    _setViewports({ viewport_configs }: { viewport_configs: ViewportConfigs }): void {
        this.#core.setViewports({ viewport_configs });
    }

    /**
     * @internal
     */
    async _castScreenSpaceRay({
        screenSpaceRayQuery,
    }: {
        screenSpaceRayQuery: ScreenSpaceRayQuery;
    }): Promise<ScreenSpaceRayResult> {
        return this.#core.castScreenSpaceRay({ screenSpaceRayQuery });
    }

    /**
     * @experimental
     */
    setFilter({ name, value }: { name: string; value: string }): void {
        const rpn = compute_rpn(value);
        this.#core.setFilter({ name, rpn });
    }

    /**
     * @experimental
     */
    toggleFilter({ name, enabled }: { name: string; enabled: boolean }): void {
        this.#core.toggleFilter({ name, enabled });
    }

    /**
     * @experimental
     */
    removeFilter({ name }: { name: string }): void {
        this.#core.removeFilter({ name });
    }
}

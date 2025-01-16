//------------------------------------------------------------------------------
import type {
    ActivityWatcher,
    Enums,
    Commands,
    Events,
    LivelinkCore,
    Queries,
    UUID,
    Vec2i,
} from "@3dverse/livelink.core";
import { DynamicLoader } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { EncodedFrameConsumer } from "./rendering/decoders/EncodedFrameConsumer";
import { DecodedFrameConsumer } from "./rendering/decoders/DecodedFrameConsumer";
import { convertRawFrameMetaDataToFrameMetaData } from "./rendering/decoders/FrameMetaData";
import { RemoteFrameProxy } from "./rendering/decoders/RemoteFrameProxy";
import { Viewport } from "./rendering/Viewport";

import { Scene } from "./scene/Scene";
import { Entity } from "./scene/Entity";

import { Session, SessionSelector } from "./session/Session";
import { SessionInfo } from "./session/SessionInfo";
import { TO_REMOVE__ViewportsAddedEvent } from "./session/SessionEvents";

import { Mouse } from "./inputs/Mouse";
import { Keyboard } from "./inputs/Keyboard";
import { Gamepad } from "./inputs/Gamepad";

/**
 * This class represents the Livelink connection between the client and the 3dverse server holding
 * the session.
 * It holds access to the actual socket connection as well as a client local representation of the
 * rendered scene.
 *
 * This class is not directly instantiable, you need to use the provided static
 * functions to create an instance:
 * - {@link Livelink.start}: to start a new session.
 * - {@link Livelink.join}: to join an exisiting session.
 * - {@link Livelink.join_or_start}: to try joining an existing session if one if found or fallback
 * to starting a new one otherwise.
 *
 * ### Connection lifecycle
 * The connection lifecycle is as follows:
 * - {@link Livelink.start}, {@link Livelink.join} or {@link Livelink.join_or_start} to create a new
 * Livelink instance.
 * - {@link Livelink.configureRemoteServer} to configure the remote server with the desired codec.
 * - {@link Livelink.addViewports} to add the viewports to the remote rendering surface so that the
 * server knows the size of the encoded frames to send.
 * - {@link Livelink.setEncodedFrameConsumer} to set the encoded frame consumer that will process the
 * encoded frames received from the server.
 * - {@link Livelink.startStreaming} to start streaming the remotely rendered frames.
 *
 * ### Input devices
 * Input devices can be activated and deactivated to the Livelink instance using the
 * {@link Livelink.devices} property.
 * The input devices are responsible for sending periodically their state to the server.
 *
 * ### Starting a new session
 *
 * ```typescript
 * const instance = await Livelink.start({
 *     scene_id: "00000000-0000-0000-0000-000000000000",
 *     token: "authentication-token",
 * });
 * ```
 *
 * ### Joining an existing session
 *
 * ```typescript
 * const session = await Session.find({
 *    scene_id: "00000000-0000-0000-0000-000000000000",
 *    token: "authentication-token",
 * });
 * const instance = await Livelink.join({session});
 * ```
 *
 * ### Joining an existing session or starting a new one if none is found
 *
 * ```typescript
 * const instance = await Livelink.join_or_start({
 *     scene_id: "00000000-0000-0000-0000-000000000000",
 *     token: "authentication-token",
 * });
 * ```
 *
 * @document ../example.md
 *
 * @category Main
 */
export class Livelink {
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP
    /**
     * @deprecated
     */
    #TO_REMOVE__readyCallback: (() => void) | null = null;

    /**
     * @deprecated
     */
    #TO_REMOVE__refreshViewportTimeout: number | null = null;

    /**
     * @deprecated
     */
    TO_REMOVE__setReadyCallback(callback: () => void): void {
        this.#TO_REMOVE__readyCallback = callback;
    }

    /**
     * @deprecated
     */
    TO_REMOVE__startIfReady(): void {
        if (!this.isConfigured()) {
            return;
        }

        if (this.viewports.some(viewport => !viewport.TO_REMOVE__ready)) {
            return;
        }

        if (this.#TO_REMOVE__readyCallback) {
            this.#TO_REMOVE__readyCallback();
            this.#TO_REMOVE__readyCallback = null;
        }
    }
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP

    /**
     * @internal
     */
    static _api_url = `https://${API_HOSTNAME}/app/v1`;

    /**
     * @internal
     */
    static _editor_url = EDITOR_URL;

    /**
     * Start a new session on the specified scene.
     *
     * @param params
     * @param params.scene_id The id of the scene to start
     * @param params.token The public access token or the user token which must have at least read
     * access to the scene
     * @param params.is_transient  Whether the session should be transient or not.
     *
     * @returns A promise to a Livelink instance holding a session with the specified scene
     *
     * @throws If the session could not be started
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
     * Try to join an existing session on the specified scene, if none is found
     * fallback to starting a new one.
     *
     * @param params
     * @param params.scene_id The id of the scene to join
     * @param params.token The public access token or the user token which must
     * have at least read access to the scene
     * @param params.session_selector A function to select the session to join
     * among the list of available sessions. If no session is found, the function should return
     * null to fallback to starting a new session.
     * @param params.is_transient  Whether the session should be transient or not.
     *
     * @returns A promise to a Livelink instance holding a session with the
     * specified scene
     *
     * @throws If the session could not be joined or started
     */
    static async join_or_start({
        scene_id,
        token,
        session_selector = ({ sessions }: { sessions: Array<SessionInfo> }): SessionInfo => sessions[0],
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
     * Join an existing session.
     *
     * @param params
     * @param params.session The session to join
     *
     * @returns A promise to a Livelink instance holding the specified session
     *
     * @throws If the session could not be joined
     */
    static async join({ session }: { session: Session }): Promise<Livelink> {
        await DynamicLoader.load();

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
     * The core object managing the connection to the server.
     */
    #core: LivelinkCore;

    /**
     * The codec used by the renderer.
     */
    #codec: Enums.CodecType | null = null;

    /**
     * The rendering surface as seen by the renderer.
     */
    #remote_rendering_surface = new RemoteFrameProxy(this);

    /**
     * User provided frame consumer designed to receive the encoded frames sent by the renderer.
     */
    #encoded_frame_consumer: EncodedFrameConsumer | null = null;

    /**
     * Mouse input device.
     */
    #mouse: Mouse;

    /**
     * Keyboard input device.
     */
    #keyboard: Keyboard;

    /**
     * Gamepad input device.
     */
    #gamepad: Gamepad;

    /**
     * Interval between updates sent to the renderer.
     */
    #update_interval = 0;

    /**
     * Interval between broadcasts sent to the editor.
     */
    #broadcast_interval = 0;

    /**
     * The default internal implementation of the {@link DecodedFrameConsumer} interface.
     *
     * If no custom decoded frame consumer is needed, this can be passed to instanciate {@link EncodedFrameConsumer}
     * implementations.
     */
    get default_decoded_frame_consumer(): DecodedFrameConsumer {
        return this.#remote_rendering_surface;
    }

    /**
     * The activity watcher disconnects the session if no activity is detected for a certain amount
     * of time.
     */
    get activity_watcher(): ActivityWatcher {
        return this.#core.activity_watcher;
    }

    /**
     * The viewports used to render the scene for the current client.
     */
    get viewports(): Array<Viewport> {
        return this.#remote_rendering_surface.viewports;
    }

    /**
     * Constructs a new Livelink instance associated with the provided session.
     *
     * @param params
     * @param params.session The session to associate with the Livelink instance
     */
    private constructor({ session }: { session: Session }) {
        this.session = session;
        this.#core = new DynamicLoader.Core();
        this.scene = new Scene(this.#core);
        this.#mouse = new Mouse(this);
        this.#keyboard = new Keyboard(this);
        this.#gamepad = new Gamepad(this);
    }

    /**
     * Disconnect from the server and release all local resources.
     *
     * Note that the session is not closed, it can be reconnected later.
     */
    async disconnect(): Promise<void> {
        this.#core.removeEventListener("on-frame-received", this.#onFrameReceived);

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

        await this.#core.disconnect();
    }

    /**
     * Add viewports to the remote rendering surface.
     *
     * @param params
     * @param params.viewports The viewports to add.
     */
    addViewports({ viewports }: { viewports: Array<Viewport> }): void {
        this.#remote_rendering_surface.addViewports({ viewports });
        this.session._dispatchEvent(new TO_REMOVE__ViewportsAddedEvent({ viewports }));
    }

    /**
     * Remove viewports from the remote rendering surface.
     *
     * @param params
     * @param params.viewport The viewport to remove.
     */
    removeViewport({ viewport }: { viewport: Viewport }): void {
        this.#remote_rendering_surface.removeViewport({ viewport });
    }

    /**
     * Configure the remote server with the desired codec.
     *
     * The viewports must have been added using {@link Livelink.addViewports} before calling this
     * method.
     *
     * @param params
     * @param params.codec The codec to use for encoding the frames.
     *
     * @returns A promise to the client configuration response.
     */
    async configureRemoteServer({
        codec = "h264",
    }: {
        codec?: Enums.CodecType;
    }): Promise<Commands.ClientConfigResponse> {
        const client_config: Commands.ClientConfig = {
            remote_canvas_size: this.#remote_rendering_surface._computeRemoteCanvasSize({ codec }),
            encoder_config: { codec, profile: "main", frame_rate: 60, lossy: true },
            supported_devices: { keyboard: true, mouse: true, gamepad: true, hololens: false, touchscreen: false },
        };

        console.debug("Initial surface size", this.#remote_rendering_surface.dimensions);
        const res = await this.#core.configureClient({ client_config });

        this.#codec = res.codec;
        return res;
    }

    /**
     * Check if the client is configured.
     */
    isConfigured(): boolean {
        return this.#codec !== null;
    }

    /**
     * Set the encoded frame consumer.
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
     * Start streaming the viewports from the server.
     */
    startStreaming(): void {
        if (!this.isConfigured()) {
            throw new Error("The Livelink instance is not configured yet");
        }

        this.#remote_rendering_surface.init();
        this.#core.resume();
        this.#startUpdateLoop({});
    }

    /**
     * Send a script event to the server to start the simulation.
     */
    startSimulation(): void {
        this.#core.setSimulationState({ state: "start_simulation" });
    }

    /**
     * Send a script event to the server to pause the simulation.
     */
    pauseSimulation(): void {
        this.#core.setSimulationState({ state: "pause_simulation" });
    }

    /**
     * Send a script event to the server to stop the simulation.
     */
    stopSimulation(): void {
        this.#core.setSimulationState({ state: "stop_simulation" });
    }

    /**
     * Send a partial skeleton pose targeting a specific animation controller.
     *
     * @param params
     * @param params.controller The entity having the animation controller component.
     * @param params.partial_pose The partial pose to send.
     */
    sendSkeletonPose({
        controller,
        partial_pose,
    }: {
        controller: Entity;
        partial_pose: Commands.SkeletonPartialPose;
    }): void {
        this.#core.sendSkeletonPose({
            controller_rtid: controller.rtid,
            partial_pose,
        });
    }

    /**
     * @experimental
     */
    get devices(): Readonly<{ mouse: Mouse; keyboard: Keyboard; gamepad: Gamepad }> {
        return {
            mouse: this.#mouse,
            keyboard: this.#keyboard,
            gamepad: this.#gamepad,
        };
    }

    /**
     * @experimental
     */
    async configureHeadlessClient(): Promise<Commands.ClientConfigResponse> {
        const client_config: Commands.ClientConfig = {
            remote_canvas_size: [8, 8],
            encoder_config: {
                codec: "h264",
                profile: "main",
                frame_rate: 30,
                lossy: true,
            },
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
     * @internal
     */
    _sendInput({ input_state }: { input_state: Commands.InputStateData }): void {
        this.#core.sendInputState({ input_state });
    }

    /**
     * @internal
     */
    async _resize({ size }: { size: Vec2i }): Promise<void> {
        const { size: remote_size } = await this.#core.resize({ size });
        this.#encoded_frame_consumer?.resize({ frame_dimensions: remote_size });
    }

    /**
     * @internal
     */
    _setViewports({ viewport_configs }: { viewport_configs: Array<Commands.ViewportConfig> }): void {
        this.#core.setViewports({ viewport_configs });
    }

    /**
     * @internal
     */
    async _castScreenSpaceRay({
        screenSpaceRayQuery,
    }: {
        screenSpaceRayQuery: Queries.ScreenSpaceRayQuery;
    }): Promise<Queries.ScreenSpaceRayResponse> {
        return this.#core.castScreenSpaceRay({ screenSpaceRayQuery });
    }

    /**
     * @internal
     */
    _refreshViewports(): void {
        if (this.#TO_REMOVE__readyCallback) {
            return;
        }

        if (this.#TO_REMOVE__refreshViewportTimeout !== null) {
            clearTimeout(this.#TO_REMOVE__refreshViewportTimeout);
        }

        this.#TO_REMOVE__refreshViewportTimeout = setTimeout(() => {
            this.#remote_rendering_surface.init();
        }, 0);
    }

    /**
     * Connect to the server and initialize the Livelink instance.
     */
    async #connect(): Promise<Livelink> {
        // Retrieve a session key
        await this.session.registerClient();

        await this.#core.connect({ session: this.session, editor_url: Livelink._editor_url });

        this.#core.addEventListener("on-entities-updated", ({ updated_entities }: Events.EntitiesUpdatedEvent) => {
            for (const { entity_euid, updated_components } of updated_entities) {
                this.scene._updateEntityFromEvent({ entity_euid, updated_components });
            }
        });

        this.#core.addEventListener(
            "on-entity-visibility-changed",
            ({ entity_rtid, is_visible }: Events.EntityVisibilityChangedEvent) => {
                this.scene._onEntityVisibilityChanged({ entity_rtid, is_visible });
            },
        );

        this.#core.addEventListener("on-frame-received", this.#onFrameReceived);
        this.#core.addEventListener("on-disconnected", this.session._onDisconnected);
        this.#core.addEventListener("on-inactivity-warning", this.session._onInactivityWarning);
        this.#core.addEventListener("on-activity-detected", this.session._onActivityDetected);

        return this;
    }

    /**
     *
     */
    #onFrameReceived = (frame_data: Events.FrameReceivedEvent): void => {
        this.session._updateClients({ core: this, client_data: frame_data.meta_data.clients });
        const meta_data = convertRawFrameMetaDataToFrameMetaData({
            raw_frame_meta_data: frame_data.meta_data,
            client_id: this.session.client_id!,
            entity_registry: this.scene._entity_registry,
            viewports: this.viewports,
        });

        this.#encoded_frame_consumer!.consumeEncodedFrame({ encoded_frame: frame_data.encoded_frame, meta_data });
    };

    /**
     *
     */
    #startUpdateLoop({
        updatesPerSecond = 30,
        broadcastsPerSecond = 1,
    }: {
        updatesPerSecond?: number;
        broadcastsPerSecond?: number;
    }): void {
        this.#update_interval = setInterval(() => {
            const update_commands = this.scene._entity_registry._getEntitiesToUpdate();
            if (update_commands.length > 0) {
                this.#core.updateEntities({ update_commands, persist: false });
            }
        }, 1000 / updatesPerSecond);

        this.#broadcast_interval = setInterval(() => {
            const update_commands = this.scene._entity_registry._getEntitiesToPersist();
            if (update_commands.length > 0) {
                this.#core.updateEntities({ update_commands, persist: true });
            }
        }, 1000 / broadcastsPerSecond);
    }
}

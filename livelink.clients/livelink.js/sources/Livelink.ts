//------------------------------------------------------------------------------
import type { Enums, Commands, Events, LivelinkCore, Queries, UUID, Vec2i } from "@3dverse/livelink.core";
import { DynamicLoader } from "@3dverse/livelink.core";
import { LivelinkBase, type LivelinkProgressCallback } from "@livelink.base/LivelinkBase";
import type { SessionSelector } from "@livelink.base/session/Session";
import type { SessionInfo } from "@livelink.base/session/SessionInfo";

//------------------------------------------------------------------------------
import { EncodedFrameConsumer } from "./rendering/streaming/EncodedFrameConsumer";
import { DecodedFrameConsumer } from "./rendering/streaming/DecodedFrameConsumer";
import { convertRawFrameMetaDataToFrameMetaData } from "./rendering/streaming/FrameMetaData";
import { RemoteFrameProxy } from "./rendering/streaming/RemoteFrameProxy";
import { Viewport } from "./rendering/camera/Viewport";

import { Scene } from "./scene/Scene";
import { Entity } from "./scene/Entity";

import { Session } from "./session/Session";
import { TO_REMOVE__ViewportsAddedEvent } from "./session/SessionEvents";

import { Mouse } from "./inputs/Mouse";
import { Keyboard } from "./inputs/Keyboard";
import { AudioPlayer } from "./audio/AudioPlayer";
import { GamepadsRegistry } from "./inputs/GamepadsRegistry";
import { BROWSER_ENV } from "./config/env";

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
 * Input devices can be accessed from the Livelink instance using the {@link Livelink.devices} property.
 * They can be activated and deactivated using the appropriate methods.
 * An active input device will automatically send its state as it changes to the server.
 *
 * ### Session management
 * Starting a new session:
 *
 * ```typescript
 * const instance = await Livelink.start({
 *     scene_id: "00000000-0000-0000-0000-000000000000",
 *     token: "authentication-token",
 * });
 * ```
 *
 * Joining an existing session:
 *
 * ```typescript
 * const session = await Session.find({
 *    scene_id: "00000000-0000-0000-0000-000000000000",
 *    token: "authentication-token",
 * });
 * const instance = await Livelink.join({session});
 * ```
 *
 * Joining an existing session or starting a new one if none is found:
 *
 * ```typescript
 * const instance = await Livelink.join_or_start({
 *     scene_id: "00000000-0000-0000-0000-000000000000",
 *     token: "authentication-token",
 * });
 * ```
 *
 * @category Main
 */
export class Livelink extends LivelinkBase<Entity, Scene, Session> {
    /**
     * Start a new session on the specified scene.
     *
     * @param params
     * @param params.scene_id The id of the scene to start
     * @param params.token The public access token or the user token which must have at least read
     * access to the scene
     * @param params.is_transient  Whether the session should be transient or not.
     * @param params.is_headless Whether the client should be headless or not.
     * @param params.onProgress Optional callback to receive progress updates during connection.
     *
     * @returns A promise to a Livelink instance holding a session with the specified scene
     *
     * @throws If the session could not be started
     */
    static async start({
        scene_id,
        token,
        is_transient = false,
        is_headless = false,
        session_options,
        onProgress,
    }: {
        scene_id: UUID;
        token: string;
        is_transient?: boolean;
        is_headless?: boolean;
        session_options?: Record<string, boolean>;
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        console.debug(`Starting new session on scene '${scene_id}'`);
        onProgress?.("creating-session");
        const session = await Session.create({ scene_id, token, is_transient, options: session_options });
        return await Livelink.join({ session, is_headless, onProgress });
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
     * @param params.is_headless Whether the client should be headless or not.
     * @param params.onProgress Optional callback to receive progress updates during connection.
     *
     * @returns A promise to a Livelink instance holding a session with the
     * specified scene
     *
     * @throws If the session could not be joined or started
     */
    static async join_or_start({
        scene_id,
        token,
        session_selector = ({ sessions }: { sessions: Array<SessionInfo> }): SessionInfo | null =>
            sessions.find(s => s.is_transient_session === is_transient) ?? null,
        is_transient = false,
        is_headless = false,
        session_options,
        onProgress,
    }: {
        scene_id: UUID;
        token: string;
        session_selector?: SessionSelector;
        is_transient?: boolean;
        is_headless?: boolean;
        session_options?: Record<string, boolean>;
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        console.debug(`Looking for sessions on scene '${scene_id}'`);
        onProgress?.("finding-session");
        const session = await Session.find({ scene_id, token, session_selector });

        if (session === null) {
            console.debug(
                `There's no session currently running on scene '${scene_id}' and satisfiying the provided selector criteria`,
            );
            return await Livelink.start({ scene_id, token, is_transient, is_headless, session_options, onProgress });
        }

        try {
            console.debug("Found session, joining...", session);
            return await Livelink.join({ session, is_headless, onProgress });
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
                is_transient,
                is_headless,
                session_options,
                onProgress,
            });
        }
    }

    /**
     * Join an existing session.
     *
     * @param params
     * @param params.session The session to join
     * @param params.is_headless Whether the client should be headless or not.
     * @param params.onProgress Optional callback to receive progress updates during connection.
     *
     * @returns A promise to a Livelink instance holding the specified session
     *
     * @throws If the session could not be joined
     */
    static async join({
        session,
        is_headless = false,
        onProgress,
    }: {
        session: Session;
        is_headless?: boolean;
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        onProgress?.("initializing");
        await DynamicLoader.load();

        console.debug("Joining session:", session);
        return new Livelink({ session }).#connect({ is_headless, onProgress });
    }

    /**
     * The codec used by the renderer.
     */
    #codec: Enums.CodecType | null = null;

    /**
     * The rendering surface as seen by the renderer.
     */
    #remote_frame_proxy = new RemoteFrameProxy(this);

    /**
     * User provided frame consumer designed to receive the encoded frames sent by the renderer.
     */
    #encoded_frame_consumer: EncodedFrameConsumer | null = null;

    /**
     * The audio player used to play the audio stream received from the server.
     */
    #audio_player: AudioPlayer | null = null;

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
    #gamepads_registry: GamepadsRegistry;

    /**
     * The renderer timestamp in miliseconds of the latest received frame.
     */
    #frame_timestamp_in_ms: number = 0;

    /**
     * The delta time in miliseconds between the two latest received frames based on renderer timestamp.
     */
    #frame_dt_in_ms: number = 0;

    /**
     * The default internal implementation of the {@link DecodedFrameConsumer} interface.
     *
     * If no custom decoded frame consumer is needed, this can be passed to instanciate {@link EncodedFrameConsumer}
     * implementations.
     */
    get default_decoded_frame_consumer(): DecodedFrameConsumer {
        return this.#remote_frame_proxy;
    }

    /**
     * The delta time in miliseconds between the two latest received frames based on renderer timestamp.
     */
    get frame_dt(): number {
        return this.#frame_dt_in_ms;
    }

    /**
     * The viewports used to render the scene for the current client.
     */
    get viewports(): Array<Viewport> {
        return this.#remote_frame_proxy.viewports;
    }

    /**
     * Constructs a new Livelink instance associated with the provided session.
     *
     * @param params
     * @param params.session The session to associate with the Livelink instance
     */
    private constructor({ session }: { session: Session }) {
        super({ session });
        this.#mouse = new Mouse(this);
        this.#keyboard = new Keyboard(this);
        this.#gamepads_registry = new GamepadsRegistry({ instance: this });
    }

    /**
     * @internal
     */
    protected _createScene({ core }: { core: LivelinkCore }): Scene {
        return new Scene(this, core);
    }

    /**
     * Disconnect from the server and release all local resources.
     *
     * Note that the session is not closed, it can be reconnected later.
     * Safe to call multiple times.
     */
    override async disconnect(): Promise<void> {
        if (this._is_disconnected) {
            return;
        }

        this.#uninstallStreamEventListeners();

        if (this.#encoded_frame_consumer !== null) {
            this.#encoded_frame_consumer.release();
        }

        this.#remote_frame_proxy.release();
        this.#audio_player?.release();

        await super.disconnect();
    }

    /**
     * Add viewports to the remote rendering surface.
     *
     * @param params
     * @param params.viewports The viewports to add.
     */
    addViewports({ viewports }: { viewports: Array<Viewport> }): void {
        this.#remote_frame_proxy.addViewports({ viewports });
        this.session._dispatchEvent(new TO_REMOVE__ViewportsAddedEvent({ viewports }));
    }

    /**
     * Remove viewports from the remote rendering surface.
     *
     * @param params
     * @param params.viewport The viewport to remove.
     */
    removeViewport({ viewport }: { viewport: Viewport }): void {
        this.#remote_frame_proxy.removeViewport({ viewport });
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
            remote_canvas_size: this.#remote_frame_proxy._computeRemoteCanvasSize({ codec }),
            encoder_config: { codec, profile: "main", frame_rate: 60, lossy: true },
            supported_devices: { keyboard: true, mouse: true, gamepad: true, hololens: false, touchscreen: false },
        };

        console.debug("Initial surface size", this.#remote_frame_proxy.dimensions);
        const res = await this._core.configureClient({ client_config });

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
            frame_dimensions: this.#remote_frame_proxy.dimensions,
        });
    }

    /**
     * Start streaming the viewports from the server.
     */
    startStreaming(): void {
        if (!this.isConfigured()) {
            throw new Error("The Livelink instance is not configured yet");
        }

        this.#audio_player = new AudioPlayer();

        this.#installStreamEventListeners();
        this.#remote_frame_proxy.init();

        if (typeof document !== "undefined") {
            this.#onVisibilityChange();
        } else {
            this._core.resume();
        }

        this._startUpdateLoop();
    }

    /**
     * @experimental
     */
    get devices(): Readonly<{ mouse: Mouse; keyboard: Keyboard; gamepads_registry: GamepadsRegistry }> {
        return {
            mouse: this.#mouse,
            keyboard: this.#keyboard,
            gamepads_registry: this.#gamepads_registry,
        };
    }

    /**
     * @experimental
     */
    async startHeadlessClient(): Promise<void> {
        this._startUpdateLoop();
    }

    /**
     * @internal
     */
    _sendInput({ input_state }: { input_state: Commands.InputStateData }): void {
        this._core.sendInputState({ input_state });
    }

    /**
     * @internal
     */
    async _resize({ size }: { size: Vec2i }): Promise<void> {
        console.debug("🙏 Requesting remote resize", size);
        const { size: remote_size } = await this._core.resize({ size });

        if (remote_size[0] === size[0] && remote_size[1] === size[1]) {
            console.debug("✅ Remote resize acknowledged", remote_size);
        } else {
            console.debug("⚠️ Remote unchanged", remote_size);
        }

        this.#encoded_frame_consumer?.resize({ frame_dimensions: remote_size });
    }

    /**
     * @internal
     */
    _setViewports({ viewport_configs }: { viewport_configs: Array<Commands.ViewportConfig> }): void {
        this._core.setViewports({ viewport_configs });
    }

    /**
     * @internal
     */
    async _castScreenSpaceRay({
        screenSpaceRayQuery,
    }: {
        screenSpaceRayQuery: Queries.ScreenSpaceRayQuery;
    }): Promise<Queries.ScreenSpaceRayResponse> {
        return this._core.castScreenSpaceRay({ screenSpaceRayQuery });
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
            this.#remote_frame_proxy.init();
        }, 0);
    }

    /**
     * @internal
     */
    _projectViewportPositionOnRemoteFrame({ viewport, position }: { viewport: Viewport; position: Vec2i }): Vec2i {
        const frame_width = this.#remote_frame_proxy.width;
        const frame_height = this.#remote_frame_proxy.height;

        const relative_position_on_viewport = viewport._getScreenPosition({ position });

        const rendering_surface_offset = [
            viewport.rendering_surface.relative_rect.left * frame_width,
            viewport.rendering_surface.relative_rect.top * frame_height,
        ];

        const viewport_offset_on_frame = [
            rendering_surface_offset[0] + viewport.offset[0],
            rendering_surface_offset[1] + viewport.offset[1],
        ];

        return [
            (viewport_offset_on_frame[0] + relative_position_on_viewport[0] * viewport.width) / frame_width,
            (viewport_offset_on_frame[1] + relative_position_on_viewport[1] * viewport.height) / frame_height,
        ];
    }

    /**
     * Connect to the server and initialize the Livelink instance.
     */
    async #connect({
        is_headless,
        onProgress,
    }: {
        is_headless: boolean;
        onProgress?: LivelinkProgressCallback;
    }): Promise<Livelink> {
        await this._connect({ is_headless, onProgress });
        return this;
    }

    /**
     * Install event listeners for the stream (audio and video)
     */
    #installStreamEventListeners(): void {
        this._core.addEventListener("on-frame-received", this.#onFrameReceived);
        this._core.addEventListener("on-audio-received", this.#onAudioReceived);

        if (BROWSER_ENV) {
            document.addEventListener("visibilitychange", this.#onVisibilityChange);
        }
    }

    /**
     * Uninstall event listeners for the stream (audio and video)
     */
    #uninstallStreamEventListeners(): void {
        this._core.removeEventListener("on-frame-received", this.#onFrameReceived);
        this._core.removeEventListener("on-audio-received", this.#onAudioReceived);

        if (BROWSER_ENV) {
            document.removeEventListener("visibilitychange", this.#onVisibilityChange);
        }
    }

    /**
     *
     */
    #onFrameReceived = ({ encoded_frame, meta_data: raw_frame_meta_data }: Events.FrameReceivedEvent): void => {
        this.session._updateClients({ client_data: raw_frame_meta_data.clients });
        const meta_data = convertRawFrameMetaDataToFrameMetaData({
            raw_frame_meta_data,
            client_id: this.session.client_id!,
            entity_registry: this.scene._entity_registry,
            viewports: this.viewports,
            resolve_client: this.session.getClient,
        });

        this.#updateFrameDeltaTime(raw_frame_meta_data.renderer_timestamp);

        this.#encoded_frame_consumer!.consumeEncodedFrame({
            encoded_frame: { video_stream: encoded_frame, meta_data },
        });
    };

    /**
     *
     */
    #updateFrameDeltaTime(renderer_timestamp: number): void {
        this.#frame_dt_in_ms = renderer_timestamp - this.#frame_timestamp_in_ms;
        this.#frame_timestamp_in_ms = renderer_timestamp;
    }

    /**
     *
     */
    #onAudioReceived = ({ packet }: Events.AudioReceivedEvent): void => {
        this.#audio_player!.playAudioPacket({ packet });
    };

    /**
     *
     */
    #onVisibilityChange = (): void => {
        if (document.hidden) {
            this._core.suspend();
        } else {
            this._core.resume();
        }
    };

    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP
    /**
     * @deprecated
     */
    #TO_REMOVE__readyCallback: (() => void) | null = null;

    /**
     * @deprecated
     */
    #TO_REMOVE__refreshViewportTimeout: ReturnType<typeof setTimeout> | null = null;

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
}

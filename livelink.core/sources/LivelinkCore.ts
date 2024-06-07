import type {
    ClientConfig,
    ClientConfigResponse,
    EditorEntity,
    EntityUpdatedEvent,
    FireEventMessage,
    FrameData,
    HighlightEntitiesMessage,
    RTID,
    ScreenSpaceRayQuery,
    ScreenSpaceRayResult,
    UUID,
    ViewportConfig,
} from "../_prebuild/types";
import { Vec2i } from "./types";
import { GatewayController } from "./controllers/GatewayController";
import { EditorController } from "./controllers/EditorController";
import { Session } from "./Session";
import { Scene } from "./Scene";
import { Entity } from "./Entity";

/**
 * The LivelinkCore interface.
 *
 * This interface must not be embedded and distributed within applications.
 * Instead, applications should embed the 3dverse/livelink.js library,
 * responsible for importing the current library, 3dverse/livelink.core.js.
 *
 * The 3dverse/livelink.js library is versioned and should refer to a specific
 * version of the interface, allowing for interface evolution without breaking
 * compatibility with existing applications.
 */
export abstract class LivelinkCore extends EventTarget {
    /**
     *
     */
    public readonly session: Session;

    /**
     *
     */
    public readonly scene = new Scene(this);

    /**
     * Holds access to the gateway.
     */
    readonly #gateway = new GatewayController();

    /**
     * Holds access to the editor.
     */
    readonly #editor = new EditorController();

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
    protected constructor(session: Session) {
        super();
        this.session = session;
        this.#gateway.addEventListener("on-script-event-received", this.scene._onScriptEventReceived);
    }

    /**
     * Connect to the session
     */
    protected async _connect(): Promise<LivelinkCore> {
        // Retrieve a session key
        await this.session.registerClient();
        // Connect to FTL gateway
        console.debug("Connecting to session...", this.session);
        const client = await this.#gateway.connectToSession({
            session: this.session,
        });
        console.debug("Connected to session as:", client);

        // Connect to the Livelink Broker
        const connectConfirmation = await this.#editor.connectToSession({
            session: this.session,
            client,
        });

        this.scene.entity_registry._configureComponentSerializer({
            component_descriptors: connectConfirmation.components,
        });

        this.#editor.addEventListener("entities-updated", (e: CustomEvent<Record<UUID, EntityUpdatedEvent>>) => {
            for (const entity_euid in e.detail) {
                this.scene.entity_registry._updateEntityFromEvent({
                    entity_euid,
                    updated_components: e.detail[entity_euid].updatedComponents,
                });
            }
        });

        this.#gateway.addEventListener("on-frame-received", this.#onFrameReceived);

        return this;
    }

    /**
     * Closes the connections to the gateway and the editor.
     */
    protected async disconnect() {
        if (this.#update_interval !== 0) {
            clearInterval(this.#update_interval);
        }

        if (this.#broadcast_interval !== 0) {
            clearInterval(this.#broadcast_interval);
        }

        this.#gateway.removeEventListener("on-script-event-received", this.scene._onScriptEventReceived);
        this.#gateway.removeEventListener("on-frame-received", this.#onFrameReceived);

        await this.session.close();

        this.#editor.disconnect();
        this.#gateway.disconnect();
    }

    /**
     *
     */
    protected startUpdateLoop({
        updatesPerSecond = 30,
        broadcastsPerSecond = 1,
    }: {
        updatesPerSecond?: number;
        broadcastsPerSecond?: number;
    }) {
        this.#update_interval = setInterval(() => {
            this.scene.entity_registry.advanceFrame({ dt: 1 / updatesPerSecond });

            const msg = this.scene.entity_registry._getEntitiesToUpdate();
            if (msg !== null) {
                this.#gateway.updateEntities({ updateEntitiesFromJsonMessage: msg });
                this.scene.entity_registry._clearUpdateList();
            }
        }, 1000 / updatesPerSecond);

        this.#broadcast_interval = setInterval(() => {
            const msg = this.scene.entity_registry._getEntitiesToBroadcast();
            if (msg !== null) {
                this.#editor.updateComponents(msg);
                this.scene.entity_registry._clearBroadcastList();
            }
        }, 1000 / broadcastsPerSecond);
    }

    /**
     * Send the configuration requested by the client.
     */
    protected async configureClient({ client_config }: { client_config: ClientConfig }): Promise<ClientConfigResponse> {
        this.#checkRemoteCanvasSize({ size: client_config.remote_canvas_size });
        return await this.#gateway.configureClient({ client_config });
    }

    /**
     *
     */
    #onFrameReceived = (e: Event) => {
        const event = e as CustomEvent<FrameData>;
        this.session._updateClients({ client_ids: event.detail.meta_data.clients.map(client => client.client_id) });
        //TODO: pass only the frame and not the meta data
        this.onFrameReceived({ frame_data: event.detail });
    };

    /**
     *
     */
    protected abstract onFrameReceived({ frame_data }: { frame_data: FrameData });

    /**
     *
     */
    resize({ size }: { size: Vec2i }) {
        this.#checkRemoteCanvasSize({ size });
        this.#gateway.resize({ size });
    }

    /**
     *
     */
    #checkRemoteCanvasSize({ size }: { size: Vec2i }): void {
        if (size[0] % 8 !== 0 || size[1] % 8 !== 0) {
            throw new Error(`Remote canvas size MUST be a multiple of 8, is [${size[0]}, ${size[1]}]`);
        }
    }

    /**
     *
     */
    async castScreenSpaceRay({
        screenSpaceRayQuery,
    }: {
        screenSpaceRayQuery: ScreenSpaceRayQuery;
    }): Promise<ScreenSpaceRayResult> {
        return this.#gateway.castScreenSpaceRay({ screenSpaceRayQuery });
    }

    /**
     *
     */
    highlightEntities({ highlightEntitiesMessage }: { highlightEntitiesMessage: HighlightEntitiesMessage }): void {
        this.#gateway.highlightEntities({ highlightEntitiesMessage });
    }

    /**
     *
     */
    fireEvent(fireEventMessage: FireEventMessage) {
        this.#gateway.fireEvent({ fireEventMessage });
    }

    /**
     *
     */
    async _createEntity({ entity }: { entity: Entity }): Promise<EditorEntity> {
        const entities = await this.#editor.spawnEntity({ entity });
        return entities[0];
    }

    /**
     *
     */
    async _findEntitiesByEUID({ entity_uuid }: { entity_uuid: UUID }): Promise<Array<EditorEntity>> {
        return this.#editor.findEntitiesByEUID({ entity_uuid });
    }

    /**
     *
     */
    updateAnimationSequenceState(params: {
        linker_rtid: RTID;
        animation_sequence_id: UUID;
        state: 1 | 0;
        playback_speed: number;
        seek_offset?: number;
    }): void {
        this.#gateway.updateAnimationSequenceState({
            updateAnimationSequenceStateMessage: params,
        });
    }

    /**
     *
     */
    setViewports({ viewports }: { viewports: Array<ViewportConfig> }) {
        this.#gateway.setViewports({ viewports });
    }

    /**
     *
     */
    resume(): void {
        this.#gateway.resume();
    }

    /**
     *
     */
    suspend(): void {
        this.#gateway.suspend();
    }

    /**
     *
     */
    startSimulation(): void {
        this.fireEvent({
            event_map_id: "00000000-0000-0000-0000-000000000000",
            event_name: "start_simulation",
            entities: [],
            data_object: {},
        });
    }
}

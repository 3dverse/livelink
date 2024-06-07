import type {
    ClientConfig,
    ClientConfigResponse,
    EditorEntity,
    EntityUpdatedEvent,
    HighlightEntitiesMessage,
    ScreenSpaceRayQuery,
    ScreenSpaceRayResult,
    UUID,
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
export class LivelinkCore extends EventTarget {
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
    protected readonly _gateway = new GatewayController();

    /**
     * Holds access to the editor.
     */
    protected readonly _editor = new EditorController();

    /**
     * Interval between update to the renderer.
     */
    private _update_interval = 0;

    /**
     * Interval between broadcasts to the editor.
     */
    private _broadcast_interval = 0;

    /**
     *
     */
    protected constructor(session: Session) {
        super();
        this.session = session;
    }

    /**
     * Connect to the session
     */
    protected async _connect(): Promise<LivelinkCore> {
        // Retrieve a session key
        await this.session.registerClient();
        // Connect to FTL gateway
        console.debug("Connecting to session...", this.session);
        const client = await this._gateway.connectToSession({
            session: this.session,
        });
        console.debug("Connected to session as:", client);

        // Connect to the Livelink Broker
        const connectConfirmation = await this._editor.connectToSession({
            session: this.session,
            client,
        });

        this.scene.entity_registry._configureComponentSerializer({
            component_descriptors: connectConfirmation.components,
        });

        this._editor.addEventListener("entities-updated", (e: CustomEvent<Record<UUID, EntityUpdatedEvent>>) => {
            for (const entity_euid in e.detail) {
                this.scene.entity_registry._updateEntityFromEvent({
                    entity_euid,
                    updated_components: e.detail[entity_euid].updatedComponents,
                });
            }
        });

        return this;
    }

    /**
     * Closes the connections to the gateway and the editor.
     */
    protected async close() {
        if (this._update_interval !== 0) {
            clearInterval(this._update_interval);
        }

        if (this._broadcast_interval !== 0) {
            clearInterval(this._broadcast_interval);
        }

        await this.session.close();

        this._editor.disconnect();
        this._gateway.disconnect();
    }

    /**
     * Send the configuration requested by the client.
     */
    protected async configureClient({ client_config }: { client_config: ClientConfig }): Promise<ClientConfigResponse> {
        this._checkRemoteCanvasSize({ size: client_config.remote_canvas_size });
        return await this._gateway.configureClient({ client_config });
    }

    /**
     *
     */
    protected resize({ size }: { size: Vec2i }) {
        this._checkRemoteCanvasSize({ size });
        this._gateway.resize({ size });
    }

    /**
     *
     */
    private _checkRemoteCanvasSize({ size }: { size: Vec2i }): void {
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
        return this._gateway.castScreenSpaceRay({ screenSpaceRayQuery });
    }

    /**
     *
     */
    highlightEntities({ highlightEntitiesMessage }: { highlightEntitiesMessage: HighlightEntitiesMessage }): void {
        this._gateway.highlightEntities({ highlightEntitiesMessage });
    }

    /**
     *
     */
    async createEntity({ entity }: { entity: Entity }): Promise<EditorEntity> {
        const entities = await this._editor.spawnEntity({ entity });
        return entities[0];
    }

    /**
     *
     */
    async _findEntitiesByEUID({ entity_uuid }: { entity_uuid: UUID }): Promise<Array<EditorEntity>> {
        return this._editor.findEntitiesByEUID({ entity_uuid });
    }

    /**
     *
     */
    startUpdateLoop({ fps }: { fps: number }) {
        this._update_interval = setInterval(() => {
            this.scene.entity_registry.advanceFrame({ dt: 1 / fps });

            const msg = this.scene.entity_registry._getEntitiesToUpdate();
            if (msg !== null) {
                this._gateway.updateEntities({ updateEntitiesFromJsonMessage: msg });
                this.scene.entity_registry._clearUpdateList();
            }
        }, 1000 / fps);

        this._broadcast_interval = setInterval(() => {
            const msg = this.scene.entity_registry._getEntitiesToBroadcast();
            if (msg !== null) {
                this._editor.updateComponents(msg);
                this.scene.entity_registry._clearBroadcastList();
            }
        }, 1000);
    }
}

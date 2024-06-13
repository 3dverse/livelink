import type {
    ClientConfig,
    ClientConfigResponse,
    ComponentDescriptor,
    EditorEntity,
    EntityBase,
    EntityCreationOptions,
    EntityUpdatedEvent,
    FireEventMessage,
    FrameData,
    HighlightEntitiesMessage,
    InputState,
    RTID,
    ScreenSpaceRayQuery,
    ScreenSpaceRayResult,
    UUID,
    UpdateEntitiesCommand,
    UpdateEntitiesFromJsonMessage,
    ViewportConfig,
} from "../_prebuild/types";
import { Vec2i } from "./types";
import { GatewayController } from "./controllers/GatewayController";
import { EditorController } from "./controllers/EditorController";
import { Session } from "./Session";

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
     * Holds access to the gateway.
     */
    readonly #gateway = new GatewayController();

    /**
     * Holds access to the editor.
     */
    readonly #editor = new EditorController();

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
        const client = await this.#gateway.connectToSession({
            session: this.session,
        });
        console.debug("Connected to session as:", client);

        // Connect to the Livelink Broker
        const connectConfirmation = await this.#editor.connectToSession({
            session: this.session,
            client,
        });

        this._installComponentSerializer({ component_descriptors: connectConfirmation.components });

        this.#gateway.addEventListener("on-frame-received", this.#onFrameReceived);

        return this;
    }

    /**
     *
     */
    protected abstract _installComponentSerializer({
        component_descriptors,
    }: {
        component_descriptors: Record<string, ComponentDescriptor>;
    }): void;

    /**
     * Closes the connections to the gateway and the editor.
     */
    protected async disconnect(): Promise<void> {
        this.#gateway.removeEventListener("on-frame-received", this.#onFrameReceived);

        await this.session.close();

        this.#editor.disconnect();
        this.#gateway.disconnect();
    }

    /**
     *
     */
    protected _addEventListener({
        target,
        event_name,
        handler,
    }: {
        target: "gateway" | "editor";
        event_name: string;
        handler: EventListenerOrEventListenerObject;
    }): void {
        if (target === "gateway") {
            this.#gateway.addEventListener(event_name, handler);
        } else {
            this.#editor.addEventListener(event_name, handler);
        }
    }

    /**
     *
     */
    protected _removeEventListener({
        target,
        event_name,
        handler,
    }: {
        target: "gateway" | "editor";
        event_name: string;
        handler: EventListenerOrEventListenerObject;
    }): void {
        if (target === "gateway") {
            this.#gateway.removeEventListener(event_name, handler);
        } else {
            this.#editor.removeEventListener(event_name, handler);
        }
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
    protected abstract onFrameReceived({ frame_data }: { frame_data: FrameData }): void;

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
    async _spawnEntity({
        entity,
        options,
    }: {
        entity: EntityBase;
        options?: EntityCreationOptions;
    }): Promise<EditorEntity> {
        const entities = await this.#editor.spawnEntity({ entity, options });
        return entities[0];
    }

    /**
     *
     */
    async _deleteEntities({ entity_uuids }: { entity_uuids: Array<UUID> }): Promise<void> {
        await this.#editor.deleteEntities({ entity_uuids });
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
    async _resolveAncestors({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<EditorEntity>> {
        return this.#editor.resolveAncestors({ entity_rtid });
    }

    /**
     *
     */
    async _getChildren({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<EditorEntity>> {
        const editor_entities_by_rtid = await this.#editor.retrieveChildren({ entity_rtid });
        return Object.values(editor_entities_by_rtid);
    }

    /**
     *
     */
    _sendInput({ input_state }: { input_state: InputState }) {
        this.#gateway.sendInputState({ input_state });
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
    assignClientToScript({
        client_uuid,
        script_uuid,
        entity_rtid,
    }: {
        client_uuid: UUID;
        script_uuid: UUID;
        entity_rtid: RTID;
    }): void {
        this.#gateway.assignClientToScript({ assignClientToScriptMessage: { client_uuid, script_uuid, entity_rtid } });
    }

    /**
     *
     */
    setViewports({ viewports }: { viewports: Array<ViewportConfig> }): void {
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

    /**
     *
     */
    protected _updateEntities(updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage) {
        this.#gateway.updateEntities({ updateEntitiesFromJsonMessage });
    }

    /**
     *
     */
    protected _updateComponents(updateEntitiesCommand: UpdateEntitiesCommand) {
        this.#editor.updateComponents(updateEntitiesCommand);
    }
}

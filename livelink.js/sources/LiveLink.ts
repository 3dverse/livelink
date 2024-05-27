import {
    LiveLinkCore,
    Session,
    ClientConfig,
    SessionInfo,
    UUID,
    Vec2i,
    SessionSelector,
    FrameData,
    CodecType,
    Entity,
    ScriptEvent,
    ViewportConfig,
} from "@livelink.core";

import type { EncodedFrameConsumer } from "./decoders/EncodedFrameConsumer";
import { RemoteRenderingSurface } from "./RemoteRenderingSurface";

/**
 * The LiveLink interface.
 *
 * This interface CAN be embedded and distributed inside applications.
 */
export class LiveLink extends LiveLinkCore {
    /**
     * Start a session with the given scene id
     *
     * @param {Object}  obj
     * @param {UUID}    obj.scene_id  The id of the scene to start
     * @param {string}  obj.token     The public access token or the user token
     *                                which must have at least read access to the
     *                                scene
     *
     * @returns {Promise<LiveLink>}   A promise to a LiveLink instance holding a
     *                                session with the specified scene
     *
     * @throws {Error} Session isues
     * @throws {Error} Gateway issues
     * @throws {Error} SEB issues
     */
    static async start({ scene_id, token }: { scene_id: UUID; token: string }): Promise<LiveLink> {
        console.debug(`Starting new session on scene '${scene_id}'`);
        const session = await new Session(scene_id, token).create();
        return await LiveLink.join({ session });
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
    }): Promise<LiveLink> {
        console.debug(`Looking for sessions on scene '${scene_id}'`);
        const session = await new Session(scene_id, token).find({
            session_selector,
        });

        if (session === null) {
            console.debug(
                `There's no session currently running on scene '${scene_id}' and satisfiying the provided selector criteria`,
            );
            return await LiveLink.start({ scene_id, token });
        }

        try {
            console.debug("Found session, joining...", session);
            return await LiveLink.join({ session });
        } catch {
            console.error(`Failed to join session '${session.session_id}', trying again with another session.`);

            return await LiveLink.join_or_start({
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
    static async join({ session }: { session: Session }): Promise<LiveLink> {
        console.debug("Joining session:", session);
        const inst = new LiveLink(session);
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
    private _frame_consumer: EncodedFrameConsumer | null = null;

    /**
     *
     */
    get remote_rendering_surface(): RemoteRenderingSurface {
        return this._remote_rendering_surface;
    }

    /**
     *
     */
    private constructor(public readonly session: Session) {
        super(session);
        this._gateway.addEventListener("on-script-event-received", this._onScriptEventReceived);
    }

    /**
     *
     */
    async close() {
        if (this._frame_consumer) {
            this._gateway.removeEventListener("on-frame-received", this._onFrameReceived);

            this._frame_consumer.release();
        }

        await super.close();
    }

    /**
     *
     */
    async configureClient({ client_config }: { client_config: ClientConfig }) {
        const res = await super.configureClient({ client_config });
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

        this._frame_consumer = await frame_consumer.configure({
            codec: this._codec,
            frame_dimensions: this.remote_rendering_surface.dimensions,
        });

        this._gateway.addEventListener("on-frame-received", this._onFrameReceived);
    }

    /**
     *
     */
    private _onFrameReceived = (e: Event) => {
        const event = e as CustomEvent<FrameData>;
        this._frame_consumer!.consumeEncodedFrame({
            encoded_frame: event.detail.encoded_frame,
        });
    };

    /**
     *
     */
    setViewports({ viewports }: { viewports: Array<ViewportConfig> }) {
        this._gateway.setViewports({ viewports });
    }

    /**
     *
     */
    resize({ size }: { size: Vec2i }): void {
        super.resize({ size });
    }

    /**
     *
     */
    resume(): void {
        this._gateway.resume();
    }

    /**
     *
     */
    suspend(): void {
        this._gateway.suspend();
    }

    /**
     *
     */
    startStreaming() {
        if (!this.isConfigured()) {
            throw new Error("The LiveLink instance is not configured yet");
        }

        //this.setViewports();
        this.resume();
    }

    /**
     *
     */
    async newEntity<EntityType extends Entity>(
        entity_type: { new (_: LiveLinkCore): EntityType },
        name: string,
    ): Promise<EntityType> {
        let entity = new entity_type(this).init(name);
        entity.onCreate();
        entity = new Proxy(entity, Entity.handler) as EntityType;
        await entity.instantiate();
        return entity;
    }

    /**
     *
     */
    async findEntity<EntityType extends Entity>(
        entity_type: { new (_: LiveLinkCore): EntityType },
        {
            entity_uuid,
        }: {
            entity_uuid: UUID;
        },
    ): Promise<EntityType | null> {
        const editor_entities = await this._editor.findEntitiesByEUID({
            entity_uuid,
        });

        if (editor_entities.length === 0) {
            return null;
        }

        const entities = editor_entities.map(
            e => new Proxy(new entity_type(this).init(e), Entity.handler) as EntityType,
        );

        for (const entity of entities) {
            this.entity_registry.add({ entity });
        }

        return entities[0];
    }

    /**
     *
     */
    private _onScriptEventReceived = (e: Event) => {
        const event = (e as CustomEvent<ScriptEvent>).detail;

        const entity = this.entity_registry.get({
            entity_rtid: event.emitter_rtid,
        });

        if (!entity) {
            return;
        }

        switch (event.event_name) {
            case "7a8cc05e-8659-4b23-99d1-1352d13e2020/enter_trigger":
                entity.onTriggerEntered();
                break;

            case "7a8cc05e-8659-4b23-99d1-1352d13e2020/exit_trigger":
                entity.onTriggerExited();
                break;
        }
    };
}

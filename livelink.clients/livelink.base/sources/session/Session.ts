//------------------------------------------------------------------------------
import type { Events, SessionInterface, UUID } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Client } from "./Client";
import { getApiUrl } from "../config/api";
import type { LivelinkInstance } from "../LivelinkInstance";
import { ClientInfo } from "./ClientInfo";
import { SessionInfo } from "./SessionInfo";
import { TypedEventTarget } from "../TypedEventTarget";
import {
    ActivityDetectedEvent,
    ClientJoinedEvent,
    ClientLeftEvent,
    DisconnectedEvent,
    InactivityWarningEvent,
    SessionEvents,
} from "./SessionEvents";

/**
 * @internal
 *
 * A function that selects a session from a list of sessions.
 *
 * @param params
 * @param params.sessions - The list of sessions to select from.
 *
 * @returns The selected session or null if no session was selected.
 *
 * @inline
 */
export type SessionSelector = ({ sessions }: { sessions: Array<SessionInfo> }) => SessionInfo | null;

/**
 * @internal
 *
 * Instance type of a class constructor.
 *
 * Unlike the built-in {@link InstanceType}, this does not constrain `T` to a public constructor,
 * so it works with classes that have a `protected` constructor (like {@link Session}). The instance
 * type is extracted from the constructor's `prototype` property instead of its construct signature.
 *
 * @inline
 */
type InstanceOf<T> = T extends { prototype: infer P } ? P : never;

/**
 * @internal
 *
 * Structural class shape used by the polymorphic statics ({@link Session.create} and friends).
 *
 * Only `prototype` (for the instance type, see {@link InstanceOf}) and `_make` are inspected, so
 * the constraint is satisfied by classes with a `protected` constructor and by non-generic
 * subclasses alike. A `T extends typeof Session` constraint would instead compare construct
 * signatures, and a subclass fixing the `ClientType` parameter (like the browser SDK's `Session`)
 * would fail that comparison.
 *
 * @inline
 */
type SessionClass = Pick<typeof Session, "prototype" | "_make">;

/**
 * A session running a scene.
 *
 * A session is a running instance of a 3dverse server rendering a scene that can be joined by
 * multiple clients.
 *
 * A session can be transient or not.
 * A transient session is temporary and changes made to the entities in the scene are not saved.
 *
 * ### Usage
 * This class is not meant to be instantiated directly. Use the static methods to create or find
 * an existing session.
 *
 * A session can be created or joined:
 * - To create a new session, use the {@link Session.create} method.
 * - To find an existing session, use the {@link Session.find} method.
 * - Or if you know the session id, use the {@link Session.findById} method.
 *
 * ### Authentication
 * To create or find a session, you need a valid authentication token that has at least
 * read access to the scene the session will use.
 *
 * See: https://docs.3dverse.com/references/api/generate-user-token
 *
 * ### Events
 * - {@link ClientJoinedEvent} - Fired when a client joins the session.
 * - {@link ClientLeftEvent} - Fired when a client leaves the session.
 * - {@link InactivityWarningEvent} - Fired when the client is inactive for a certain amount of time.
 * - {@link ActivityDetectedEvent} - Fired when the client is active again.
 * - {@link DisconnectedEvent} - Fired when the session is disconnected.
 *
 * See: {@link SessionEvents} for more details.
 *
 * @category Session
 */
export class Session<ClientType extends Client = Client>
    extends TypedEventTarget<SessionEvents<ClientType>>
    implements SessionInterface
{
    /**
     * @internal
     *
     * Create a new session instance of the class this is called on.
     */
    static _make<T extends SessionClass>(
        this: T,
        params: { token: string; session_info: SessionInfo; created: boolean; is_guest?: boolean },
    ): InstanceOf<T> {
        // `this` is the concrete (sub)class; its constructor is protected, so it exposes no
        // structural construct signature — cast once, here.
        const Ctor = this as unknown as new (params: {
            token: string;
            session_info: SessionInfo;
            created: boolean;
            is_guest?: boolean;
        }) => InstanceOf<T>;
        return new Ctor(params);
    }

    /**
     * Create a new session.
     *
     * @param params
     * @param params.scene_id - The unique identifier of the scene the session will launch.
     * @param params.token - The authentication token. This token must have at least read access to the scene.
     * @param params.is_transient - Whether the session is transient. Transient sessions are temporary and changes are not saved.
     *
     * @returns A promise that resolves to the created session.
     *
     * @throws Error if the session could not be created.
     */
    static async create<T extends SessionClass>(
        this: T,
        {
            scene_id,
            token,
            is_transient,
            options,
        }: {
            scene_id: UUID;
            token: string;
            is_transient?: boolean;
            options?: Record<string, boolean>;
        },
    ): Promise<InstanceOf<T>> {
        const res = await fetch(`${getApiUrl()}/sessions`, {
            method: "POST",
            body: JSON.stringify({ scene_id, is_transient, options }),
            headers: {
                "Content-Type": "application/json",
                user_token: token,
            },
        });

        if (!res.ok) {
            throw new Error("Error when creating session");
        }

        const session_info = (await res.json()) as { session_id: UUID };
        return this._make({
            token,
            session_info: {
                ...session_info,
                scene_id,
                is_transient_session: is_transient ?? false,
            },
            created: true,
        });
    }

    /**
     * Create a session instance from a session info, without creating or joining anything server-side.
     *
     * @param params
     * @param params.session_info - The information about the session.
     * @param params.token - The authentication token.
     *
     * @returns The session instance.
     */
    static createFromInfo<T extends SessionClass>(
        this: T,
        { session_info, token }: { session_info: SessionInfo; token: string },
    ): InstanceOf<T> {
        return this._make({ token, session_info, created: false });
    }

    /**
     * List all existing sessions running the specified scene.
     *
     * @param params
     * @param params.scene_id - The unique identifier of the scene the sessions must be running.
     * @param params.token - The authentication token.
     *
     * @returns A promise that resolves to the list of sessions running the scene, or to an empty
     * list if the sessions could not be listed (a non-OK API response is treated as a legitimate
     * impossibility to list the sessions of the scene, not as an error).
     */
    static async list({ scene_id, token }: { scene_id: UUID; token: string }): Promise<Array<SessionInfo>> {
        const res = await fetch(`${getApiUrl()}/sessions?filters[scene_id]=${scene_id}`, {
            method: "GET",
            headers: {
                user_token: token,
            },
        });

        if (!res.ok) {
            console.debug(`Could not list sessions for scene ${scene_id}: ${res.status}.`);
            return [];
        }

        return (await res.json()) as Array<SessionInfo>;
    }

    /**
     * Find an existing session running the specified scene.
     *
     * @param params
     * @param params.scene_id - The unique identifier of the scene the session must be running.
     * @param params.token - The authentication token. This token must have at least read access to the scene.
     * @param params.session_selector - A callback that selects a session from a list of candidate sessions.
     *
     * @returns A promise that resolves to the found session, or null if no session was found:
     * no session is running the scene, the session selector selected none, or the sessions could
     * not be listed (see {@link Session.list}).
     */
    static async find<T extends SessionClass>(
        this: T,
        {
            scene_id,
            token,
            session_selector,
        }: {
            scene_id: UUID;
            token: string;
            session_selector: SessionSelector;
        },
    ): Promise<InstanceOf<T> | null> {
        const sessions = await Session.list({ scene_id, token });

        if (sessions.length === 0) {
            return null;
        }

        const session_info = session_selector({ sessions });
        if (!session_info) {
            return null;
        }

        return this._make({ token, session_info, created: false });
    }

    /**
     * Find an existing session by its unique identifier.
     *
     * @param params
     * @param params.session_id - The unique identifier of the session to find.
     * @param params.token - The authentication token. This token must have at least read access to the scene.
     *
     * @returns A promise that resolves to the found session or null if no session was found.
     */
    static async findById<T extends SessionClass>(
        this: T,
        {
            session_id,
            token,
        }: {
            session_id: UUID;
            token: string;
        },
    ): Promise<InstanceOf<T> | null> {
        const res = await fetch(`${getApiUrl()}/sessions/${session_id}`, {
            method: "GET",
            headers: {
                user_token: token,
            },
        });

        if (!res.ok) {
            console.debug(`Could not find session with id ${session_id}.`);
            return null;
        }

        const session_info = (await res.json()) as SessionInfo;
        return this._make({ token, session_info, created: false });
    }

    /**
     * Find the session tied to a guest token.
     *
     * @param params
     * @param params.guest_token - The guest token generated by the [Generate Guest Token](https://docs.3dverse.com/references/api/generate-guest-token) endpoint.
     *
     * @returns A promise that resolves to the found session or null if no session was found.
     */
    static async findByGuestToken<T extends SessionClass>(
        this: T,
        { guest_token }: { guest_token: string },
    ): Promise<InstanceOf<T> | null> {
        const res = await fetch(`${getApiUrl()}/sessions`, {
            method: "GET",
            headers: { guest_token },
        });

        if (!res.ok) {
            throw new Error("Could not find session as guest, guest token might be expired");
        }

        const [session_info] = (await res.json()) as [SessionInfo];
        return this._make({ token: guest_token, session_info, created: false, is_guest: true });
    }

    /**
     * The information about the session.
     */
    public readonly info: SessionInfo;

    /**
     * Whether the session has been created or joined by the current client.
     */
    public readonly has_been_created: boolean;

    /**
     * The id of the client that is currently connected to the session.
     */
    public client_id: UUID | null = null;

    /**
     * The authentication token.
     */
    public readonly token: string;

    /**
     * Whether the authentication token is a guest token.
     */
    public readonly is_guest: boolean = false;

    /**
     * The address of the gateway the session is running on.
     */
    #gateway_url: string | null = null;

    /**
     * The session key used as an authentication method on the gateway.
     */
    #session_key: string | null = null;

    /**
     * A map of all connected clients
     */
    #clients: Map<UUID, ClientType> = new Map<UUID, ClientType>();

    /**
     * The unique identifier of the scene the session is running.
     */
    get scene_id(): UUID {
        return this.info.scene_id;
    }

    /**
     * The unique identifier of the session.
     */
    get session_id(): UUID {
        return this.info.session_id;
    }

    /**
     * The unique identifiers of all clients connected to the session.
     */
    get client_ids(): Array<UUID> {
        return Array.from(this.#clients.keys());
    }

    /**
     * All the clients connected to the session.
     */
    get clients(): Array<ClientType> {
        return Array.from(this.#clients.values());
    }

    /**
     * All the clients connected to the session except the current client.
     */
    get other_clients(): Array<ClientType> {
        return Array.from(this.#clients.values()).filter(c => c.id !== this.client_id);
    }

    /**
     * The current client connected to the session.
     */
    get current_client(): ClientType | null {
        return this.client_id ? (this.#clients.get(this.client_id) ?? null) : null;
    }

    /**
     * @internal
     * The address of the gateway the session is running on.
     */
    get gateway_url(): string | null {
        return this.#gateway_url;
    }

    /**
     * @internal
     * The session key used as an authentication method on the gateway.
     */
    get session_key(): string | null {
        return this.#session_key;
    }

    /**
     * Authentication headers to be used in requests to the API.
     */
    get #authentication_headers(): Record<string, string> {
        return this.is_guest ? { guest_token: this.token } : { user_token: this.token };
    }

    /**
     * Create a new session.
     *
     * @param params
     * @param params.token - The authentication token. This token must have at least read access to the scene.
     * @param params.session_info - The information about the session.
     * @param params.created - Whether the session has been created or found by the current client.
     */
    protected constructor({
        token,
        session_info,
        created,
        is_guest = false,
    }: {
        token: string;
        session_info: SessionInfo;
        created: boolean;
        is_guest?: boolean;
    }) {
        super();

        this.token = token;
        this.info = session_info;
        this.has_been_created = created;
        this.is_guest = is_guest;
    }

    /**
     * Whether the session is joinable.
     */
    isJoinable(): boolean {
        return this.#gateway_url !== null && this.#session_key !== null;
    }

    /**
     * @internal
     * Get the session key to be used as an authentication method on the gateway.
     */
    async registerClient({ is_headless }: { is_headless: boolean }): Promise<void> {
        const res = await fetch(`${getApiUrl()}/sessions/${this.session_id}/clients`, {
            method: "POST",
            headers: { ...this.#authentication_headers, "Content-Type": "application/json" },
            body: JSON.stringify({ is_headless }),
        });

        if (!res.ok) {
            throw new Error("Error when registering client to session");
        }

        const { session_token, endpoint_info } = (await res.json()) as {
            session_token: string;
            endpoint_info: { ip: string; port: number; ssl_port: number };
        };

        // Gateways that don't support secure connections set their SSL port to 0.
        const protocol = endpoint_info.ssl_port ? "wss" : "ws";
        const port = endpoint_info.ssl_port !== 0 ? endpoint_info.ssl_port : endpoint_info.port;
        this.#gateway_url = `${protocol}://${endpoint_info.ip}:${port}`;
        this.#session_key = session_token;
    }

    /**
     * @internal
     * Close the session.
     */
    async close(): Promise<void> {
        await fetch(`${getApiUrl()}/sessions/${this.session_id}`, {
            method: "DELETE",
            headers: this.#authentication_headers,
        });
    }

    /**
     * Get a client by its unique identifier.
     *
     * @param params
     * @param params.client_id - The unique identifier of the client to look for.
     *
     * @returns The client or null if the client is not found.
     */
    getClient = ({ client_id }: { client_id: UUID }): ClientType | null => {
        return this.#clients.get(client_id) ?? null;
    };

    /**
     * Evict a client from the session.
     *
     * The client will be disconnected.
     *
     * The token used to create the session must have manage access to the scene.
     *
     * Note that nothing prevents the client from reconnecting while the session is still running.
     *
     * @param params
     * @param params.client - The client to evict, either a {@link Client} object or the unique identifier of the client.
     *
     * @returns A promise that resolves to true if the client was evicted, false otherwise.
     */
    async evictClient({ client }: { client: Client | UUID }): Promise<boolean> {
        const client_id = client instanceof Client ? client.id : client;
        const res = await fetch(`${getApiUrl()}/sessions/${this.session_id}/clients/${client_id}`, {
            method: "DELETE",
            headers: this.#authentication_headers,
        });

        return res.ok;
    }

    /**
     * @internal
     */
    _onDisconnected = (e: Events.DisconnectedEvent): void => {
        this._dispatchEvent(new DisconnectedEvent({ reason: e.reason }));
    };

    /**
     * @internal
     */
    _onInactivityWarning = (e: Events.InactivityWarningEvent): void => {
        this._dispatchEvent(
            new InactivityWarningEvent({ seconds_remaining: e.seconds_remaining, reset_timer: e.resetTimer }),
        );
    };

    /**
     * @internal
     */
    _onActivityDetected = (_: Events.ActivityDetectedEvent): void => {
        this._dispatchEvent(new ActivityDetectedEvent());
    };

    /**
     * @internal
     */
    _onClientJoined({ core, client_info }: { core: LivelinkInstance; client_info: ClientInfo }): void {
        console.debug("--- Client joined", client_info);
        const client = this._instantiateClient({ core, client_info, session_id: this.session_id });
        this.#clients.set(client.id, client);
        if (client.id !== this.client_id) {
            this._dispatchEvent(new ClientJoinedEvent({ client }));
        }
    }

    /**
     * @internal
     */
    _onClientLeft({ client_id }: { client_id: UUID }): void {
        const client = this.#clients.get(client_id);
        if (client) {
            this.#clients.delete(client_id);
            this._dispatchEvent(new ClientLeftEvent({ client }));
        }
    }

    /**
     * @internal
     */
    _instantiateClient({
        core,
        client_info,
        session_id,
    }: {
        core: LivelinkInstance;
        client_info: ClientInfo;
        session_id: UUID;
    }): ClientType {
        const client = new Client({
            core,
            client_info,
            session_id,
        });
        return client as ClientType;
    }
}

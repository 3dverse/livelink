//------------------------------------------------------------------------------
import type { ClientMetaData, SessionInterface, UUID } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Client } from "./Client";
import { Livelink } from "../Livelink";
import { ClientInfo } from "./ClientInfo";
import { SessionInfo } from "./SessionInfo";

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
 * See: https://docs.3dverse.com/api/#tag/User-Authentication/operation/generateUserToken
 *
 * ### Events
 * - `on-disconnected` - Fired when the session is disconnected.
 * - `client-joined` - Fired when a client joins the session.
 * - `client-left` - Fired when a client leaves the session.
 *
 * @category Session
 */
export class Session extends EventTarget implements SessionInterface {
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
    static async create({
        scene_id,
        token,
        is_transient,
    }: {
        scene_id: UUID;
        token: string;
        is_transient?: boolean;
    }): Promise<Session> {
        const res = await fetch(`${Livelink._api_url}/sessions`, {
            method: "POST",
            body: JSON.stringify({ scene_id, is_transient }),
            headers: {
                "Content-Type": "application/json",
                user_token: token,
            },
        });

        if (res.status !== 200) {
            throw new Error("Error when creating session");
        }

        const session_info = (await res.json()) as { session_id: UUID };
        return new Session({
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
     * Find an existing session running the specified scene.
     *
     * @param params
     * @param params.scene_id - The unique identifier of the scene the session must be running.
     * @param params.token - The authentication token. This token must have at least read access to the scene.
     * @param params.session_selector - A callback that selects a session from a list of candidate sessions.
     *
     * @returns A promise that resolves to the found session or null if no session was found or
     * if no session was selected by the session selector.
     */
    static async find({
        scene_id,
        token,
        session_selector,
    }: {
        scene_id: UUID;
        token: string;
        session_selector: SessionSelector;
    }): Promise<Session | null> {
        const res = await fetch(`${Livelink._api_url}/sessions?filters[scene_id]=${scene_id}`, {
            method: "GET",
            headers: {
                user_token: token,
            },
        });

        const sessions = (await res.json()) as Array<SessionInfo>;
        if (sessions.length === 0) {
            return null;
        }

        const session_info = session_selector({ sessions });
        if (!session_info) {
            return null;
        }

        return new Session({ token, session_info, created: false });
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
    static async findById({ session_id, token }: { session_id: UUID; token: string }): Promise<Session | null> {
        const res = await fetch(`${Livelink._api_url}/sessions/${session_id}`, {
            method: "GET",
            headers: {
                user_token: token,
            },
        });

        if (res.status != 200) {
            console.debug(`Could not find session with id ${session_id}.`);
            return null;
        }

        const session_info = (await res.json()) as SessionInfo;
        return new Session({ token, session_info, created: false });
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
    #clients: Map<UUID, Client> = new Map<UUID, Client>();

    /**
     * A map for clients pending identification
     */
    #clients_pending_identification = new Set<UUID>();

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
    get clients(): Array<Client> {
        return Array.from(this.#clients.values());
    }

    /**
     * All the clients connected to the session except the current client.
     */
    get other_clients(): Array<Client> {
        return Array.from(this.#clients.values()).filter(c => c.id !== this.client_id);
    }

    /**
     * The current client connected to the session.
     */
    get current_client(): Client | null {
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
     * Create a new session.
     *
     * @param params
     * @param params.token - The authentication token. This token must have at least read access to the scene.
     * @param params.session_info - The information about the session.
     * @param params.created - Whether the session has been created or found by the current client.
     */
    private constructor({
        token,
        session_info,
        created,
    }: {
        token: string;
        session_info: SessionInfo;
        created: boolean;
    }) {
        super();

        this.token = token;
        this.info = session_info;
        this.has_been_created = created;
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
    async registerClient(): Promise<void> {
        const res = await fetch(`${Livelink._api_url}/sessions/${this.session_id}/clients`, {
            method: "POST",
            headers: {
                user_token: this.token,
            },
        });

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
        if (this.info === null) {
            throw new Error("Cannot close session as it has not been opened yet");
        }

        await fetch(`${Livelink._api_url}/sessions/${this.session_id}`, {
            method: "DELETE",
            headers: {
                api_key: this.token,
            },
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
    getClient({ client_id }: { client_id: UUID }): Client | null {
        return this.#clients.get(client_id) ?? null;
    }

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
        const res = await fetch(`${Livelink._api_url}/sessions/${this.session_id}/clients/${client_id}`, {
            method: "DELETE",
            headers: {
                user_token: this.token,
            },
        });

        return res.status === 200;
    }

    /**
     * @internal
     */
    _onDisconnected(e: Event): void {
        this.dispatchEvent(new CustomEvent("on-disconnected", { detail: (e as CustomEvent<unknown>).detail }));
    }

    /**
     * @internal
     */
    _updateClients({ client_data }: { client_data: Array<ClientMetaData> }): void {
        for (const client_meta_data of client_data) {
            const client_id = client_meta_data.client_id;

            if (this.#clients_pending_identification.has(client_id)) {
                continue;
            }

            const client = this.#clients.get(client_id);
            if (client) {
                this.#handleExistingClient({ client, client_meta_data });
            } else {
                this.#handleNewClient({ client_meta_data });
            }
        }

        this.#removeDisconnectedClients({ client_data });
    }

    /**
     *
     */
    async #handleNewClient({ client_meta_data }: { client_meta_data: ClientMetaData }): Promise<void> {
        const client_id = client_meta_data.client_id;

        this.#clients_pending_identification.add(client_id);
        let client_info: ClientInfo | null = null;

        try {
            client_info = await this.#fetchClientInfo({ client_id: client_meta_data.client_id });
        } catch (error) {
            console.error("Could not get info for client", client_id, error);
            client_info = {
                client_id,
                client_type: "unknown",
                user_id: "",
                username: "unknown user",
            };
        }

        console.debug("--- Client joined", client_info);
        const client = new Client({ client_info, client_meta_data });
        this.#onClientJoined({ client });
        this.#clients_pending_identification.delete(client_id);
    }

    /**
     *
     */
    #handleExistingClient({ client, client_meta_data }: { client: Client; client_meta_data: ClientMetaData }): void {
        client._updateFromClientMetaData({ client_meta_data });
    }

    /**
     *
     */
    #removeDisconnectedClients({ client_data }: { client_data: Array<ClientMetaData> }): void {
        const client_ids = client_data.map(d => d.client_id);

        for (const [client_id] of this.#clients) {
            if (!client_ids.includes(client_id)) {
                this.#onClientLeft({ client_id });
            }
        }
    }

    /**
     *
     */
    #onClientJoined({ client }: { client: Client }): void {
        this.#clients.set(client.id, client);
        if (client.id !== this.client_id) {
            this.dispatchEvent(new CustomEvent("client-joined", { detail: client }));
        }
    }

    /**
     *
     */
    #onClientLeft({ client_id }: { client_id: UUID }): void {
        const client = this.getClient({ client_id });
        if (client) {
            this.#clients.delete(client_id);
            this.dispatchEvent(new CustomEvent("client-left", { detail: client }));
        }
    }

    /**
     *
     */
    async #fetchClientInfo({ client_id }: { client_id: UUID }): Promise<ClientInfo> {
        const res = await fetch(`${Livelink._api_url}/sessions/${this.session_id}/clients/${client_id}`, {
            method: "GET",
            headers: {
                user_token: this.token,
            },
        });

        return (await res.json()) as ClientInfo;
    }
}

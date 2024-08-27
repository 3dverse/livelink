import type { ClientMetaData, SessionInterface, UUID } from "@3dverse/livelink.core";
import { Client } from "./Client";
import { Livelink } from "./Livelink";

/**
 *
 */
type ClientInfo = {
    client_id: UUID;
    client_type: "user" | "guest";
    user_id: UUID;
    username: string;
};

/**
 *
 */
export type SessionInfo = {
    readonly session_id: UUID;
    readonly scene_id: UUID;
    readonly scene_name: string;
    readonly folder_id: UUID;
    readonly max_users: number;
    readonly created_by: UUID;
    readonly created_at: Date;
    readonly country_code: string;
    readonly continent_code: string;
    readonly is_transient_session: boolean;
    readonly clients: Array<ClientInfo>;
};

/**
 * Session selector function type.
 *
 * @param {Array<SessionInfo>} sessions - An array of session information running the targeted scene.
 *
 * @returns {SessionInfo | null} -The selected session or null
 */
export type SessionSelector = ({ sessions }: { sessions: Array<SessionInfo> }) => SessionInfo | null;

/**
 *
 */
export class Session extends EventTarget implements SessionInterface {
    /**
     * Create a new session with the provided scene.
     *
     * @returns {Session} returns the current instance
     * @example
     * const session = await Session.create({scene_id, token});
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

        const session_info = (await res.json()) as SessionInfo;
        return new Session({ token, session_info, created: true });
    }

    /**
     * Asynchronous function to find and select a session based on the specified session selector.
     *
     * @param {Object} options - The options object.
     * @param {SessionSelector} options.session_selector - The function for selecting a session from
     *                          the retrieved sessions.
     *
     * @returns {Promise<Session | null>} - Resolves with the selected session or
     *    null if none is found.
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
     * Asynchronous function to find a session based on the specified id.
     *
     * @returns {Promise<Session | null>} - Resolves with the found session or null if not found.
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
     * Various info on the session.
     */
    public readonly info: SessionInfo;

    /**
     *
     */
    public readonly has_been_created: boolean;

    /**
     *
     */
    public client_id: UUID | null = null;

    /**
     *
     */
    readonly #token: string;

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
     *
     */
    get scene_id() {
        return this.info.scene_id;
    }
    get session_id() {
        return this.info.session_id;
    }
    get gateway_url() {
        return this.#gateway_url;
    }
    get session_key() {
        return this.#session_key;
    }
    get client_ids(): Array<UUID> {
        return Array.from(this.#clients.keys());
    }
    get clients(): Array<Client> {
        return Array.from(this.#clients.values());
    }

    /**
     * @param {UUID} scene_id - The id of the scene
     * @param {string} token - The authentication token
     *
     * @see https://docs.3dverse.com/api/#tag/User-Authentication/operation/generateUserToken
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

        this.#token = token;
        this.info = session_info;
        this.has_been_created = created;
    }

    /**
     * Checks if the session is eligible for joining.
     * For it to be deemed joinable, either the [create()]{@link Session#create}
     * or [find()]{@link Session#join} method must have been invoked.
     *
     * @returns {boolean} True if the session can be joined, false otherwise.
     */
    isJoinable(): boolean {
        return this.#gateway_url !== null && this.#session_key !== null;
    }

    /**
     *
     */
    async registerClient(): Promise<void> {
        const res = await fetch(`${Livelink._api_url}/sessions/${this.session_id}/clients`, {
            method: "POST",
            headers: {
                user_token: this.#token,
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
     *
     */
    async close() {
        if (this.info === null) {
            throw new Error("Cannot close session as it has not been opened yet");
        }

        const res = await fetch(`${Livelink._api_url}/sessions/${this.session_id}`, {
            method: "DELETE",
            headers: {
                api_key: this.#token,
            },
        });

        console.log(res);
    }

    /**
     * Retrieves a client based on the provided client id.
     *
     * @param {UUID} client_id  - The id of the client.
     *
     * @returns {Client | null} - The matching client or null if not found.
     */
    getClient({ client_id }: { client_id: UUID }): Client | null {
        return this.#clients.get(client_id) ?? null;
    }

    /**
     *
     */
    async kickClient({ client }: { client: Client | UUID }) {
        const client_id = client instanceof Client ? client.id : client;
        const res = await fetch(`${Livelink._api_url}/sessions/${this.session_id}/clients/${client_id}`, {
            method: "DELETE",
            headers: {
                user_token: this.#token,
            },
        });

        console.log(res);
    }

    /**
     *
     */
    _updateClients({ client_data }: { client_data: Array<ClientMetaData> }): void {
        for (const data of client_data) {
            if (!this.#clients.has(data.client_id)) {
                if (data.viewports.some(v => v.camera_rtid)) {
                    this._onClientJoined({ client: new Client(data) });
                }
            }
        }

        const client_ids = client_data.map(d => d.client_id);
        for (const [client_id] of this.#clients) {
            if (!client_ids.includes(client_id)) {
                this._onClientLeft({ client_id });
            }
        }
    }

    /**
     *
     * @param client The client to register
     */
    _onClientJoined({ client }: { client: Client }): void {
        this.#clients.set(client.id, client);
        if (client.id !== this.client_id) {
            this.dispatchEvent(new CustomEvent("client-joined", { detail: client }));
        }
    }

    /**
     *
     * @param client The client to unregister
     */
    _onClientLeft({ client_id }: { client_id: UUID }): void {
        const client = this.getClient({ client_id });
        if (client) {
            this.#clients.delete(client_id);
            this.dispatchEvent(new CustomEvent("client-left", { detail: client }));
        }
    }

    /**
     *
     *
     */
    _onDisconnected(e: Event): void {
        this.dispatchEvent(new CustomEvent("on-disconnected"));
    }
}

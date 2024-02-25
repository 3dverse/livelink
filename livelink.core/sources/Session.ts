import { UUID } from "./types/common";
import { Client } from "./Client";

const api_url = "https://api.3dverse.dev/app/v1";

/**
 *
 */
export type SessionInfo = {
  readonly session_id: UUID;
  readonly scene_name: string;
  readonly folder_id: UUID;
  readonly max_users: number;
  readonly created_by: UUID;
  readonly created_at: Date;
  readonly country_code: string;
  readonly continent_code: string;
};

/**
 * Session selector function type.
 *
 * @param {Array<SessionInfo>} sessions - An array of session information
 *    running the targeted scene.
 *
 * @returns {SessionInfo | null} -The selected session or null
 */
export type SessionSelector = ({
  sessions,
}: {
  sessions: Array<SessionInfo>;
}) => SessionInfo | null;

/**
 *
 */
export class Session extends EventTarget {
  /**
   * Various info on the session.
   */
  private _session_info: SessionInfo | null = null;

  /**
   * The address of the gateway the session is running on.
   */
  private _gateway_url: string | null = null;

  /**
   * The session key used as an authentication method on the gateway.
   */
  private _session_key: string | null = null;

  /**
   * A map of all connected clients
   */
  private _clients: Map<UUID, Client> = new Map<UUID, Client>();

  /**
   *
   */
  get scene_id() {
    return this._scene_id;
  }
  get session_id() {
    return this._session_info?.session_id;
  }
  get gateway_url() {
    return this._gateway_url;
  }
  get session_key() {
    return this._session_key;
  }

  /**
   * @param {UUID} _scene_id - The id of the scene
   * @param {string} _token - The authentication token
   *
   * @see https://docs.3dverse.com/api/#tag/User-Authentication/operation/generateUserToken
   */
  constructor(
    private readonly _scene_id: UUID,
    private readonly _token: string
  ) {
    super();
  }

  /**
   * Checks if the session is eligible for joining.
   * For it to be deemed joinable, either the [create()]{@link Session#create}
   * or [find()]{@link Session#join} method must have been invoked.
   *
   * @returns {boolean} True if the session can be joined, false otherwise.
   */
  isJoinable(): boolean {
    return this._gateway_url !== null && this._session_key !== null;
  }

  /**
   * Create a new session with the provided scene.
   *
   * @returns {Session} returns the current instance
   * @example
   * const session = await new Session(scene_id, token).create();
   */
  async create(): Promise<Session> {
    const res = await fetch(`${api_url}/sessions`, {
      method: "POST",
      body: JSON.stringify({ scene_id: this._scene_id }),
      headers: {
        "Content-Type": "application/json",
        user_token: this._token,
      },
    });

    if (res.status !== 200) {
      throw new Error("Error when creating session");
    }

    this._session_info = (await res.json()) as SessionInfo;
    return this;
  }

  /**
   * Asynchronous function to find and select a session based on the specified
   * session selector.
   *
   * @param {Object} options - The options object.
   * @param {SessionSelector} options.session_selector - The function for
   *    selecting a session from the retrieved sessions.
   *
   * @returns {Promise<Session | null>} - Resolves with the selected session or
   *    null if none is found.
   */
  async find({
    session_selector,
  }: {
    session_selector: SessionSelector;
  }): Promise<Session | null> {
    const res = await fetch(`${api_url}/sessions?scene_id=${this._scene_id}`, {
      method: "GET",
      headers: {
        user_token: this._token,
      },
    });

    const { sessions } = (await res.json()) as {
      sessions: Array<SessionInfo>;
    };

    if (sessions.length === 0) {
      return null;
    }

    const session = session_selector({ sessions });
    if (!session) {
      return null;
    }

    this._session_info = session;
    return this;
  }

  /**
   *
   */
  async registerClient(): Promise<void> {
    const res = await fetch(`${api_url}/sessions/${this.session_id}/clients`, {
      method: "POST",
      headers: {
        user_token: this._token,
      },
    });

    const { session_token, endpoint_info } = (await res.json()) as {
      session_token: string;
      endpoint_info: { ip: string; port: number; ssl_port: number };
    };

    //TODO: have the gateways decide whether or not they support secure
    //      connections.
    endpoint_info.ssl_port = 0;

    const protocol = endpoint_info.ssl_port ? "wss" : "ws";
    const port =
      endpoint_info.ssl_port !== 0
        ? endpoint_info.ssl_port
        : endpoint_info.port;
    this._gateway_url = `${protocol}://${endpoint_info.ip}:${port}`;
    this._session_key = session_token;
  }

  /**
   *
   */
  async close() {
    if (this._session_info === null) {
      throw new Error("Cannot close session as it has not been opened yet");
    }

    const res = await fetch(`${api_url}/sessions/${this.session_id}`, {
      method: "DELETE",
      headers: {
        api_key: this._token,
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
    return this._clients.get(client_id) ?? null;
  }

  /**
   *
   */
  async kickClient({ client }: { client: Client | UUID }) {
    const client_id = client instanceof Client ? client.uuid : client;
    const res = await fetch(
      `${api_url}/sessions/${this.session_id}/clients/${client_id}`,
      {
        method: "DELETE",
        headers: {
          user_token: this._token,
        },
      }
    );

    console.log(res);
  }

  /**
   *
   * @param client The client to register
   */
  _onClientJoined({ client }: { client: Client }): void {
    this._clients.set(client.uuid, client);
    this.dispatchEvent(new CustomEvent("on-client-joined", { detail: client }));
  }

  /**
   *
   * @param client The client to unregister
   */
  _onClientLeft({ client_id }: { client_id: UUID }): void {
    const client = this.getClient({ client_id });
    if (client) {
      this._clients.delete(client_id);
      this.dispatchEvent(new CustomEvent("on-client-left", { detail: client }));
    }
  }
}

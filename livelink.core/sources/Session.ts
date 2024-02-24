import { UUID } from "./types/common";
import { Client } from "./Client";

const api_url = "https://api.3dverse.dev/app/v1";

/**
 *
 */
export type SessionInfo = {
  session_id: UUID;
};

/**
 *
 */
export type SessionSelector = ({
  sessions,
}: {
  sessions: Array<SessionInfo>;
}) => SessionInfo;

/**
 *
 */
export class Session extends EventTarget {
  /**
   * The id of the session
   */
  private _session_info: SessionInfo | null = null;

  /**
   * The address of the gateway the session is running on
   */
  private _gateway_url: string | null = null;

  /**
   * The session key used to authenticate the client on the gateway
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
   *
  readonly scene_name: string;
  readonly folder_id: UUID;
  readonly max_users: number;
  readonly created_by: UUID;
  readonly created_at: Date;
  readonly country_code: string;
  readonly continent_code: string;
  */

  /**
   *
   */
  constructor(
    private readonly _scene_id: UUID,
    private readonly _token: string
  ) {
    super();
  }

  /**
   *
   */
  isValid() {
    return this._gateway_url !== null && this._session_key !== null;
  }

  /**
   *
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
   * @returns Current session or null if no session has been found or selected
   *          by the selector.
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
  async createClient(): Promise<void> {
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

    //this._gateway_url = `wss://${endpoint_info.ip}:${endpoint_info.ssl_port}`;
    this._gateway_url = `ws://${endpoint_info.ip}:${endpoint_info.port}`;
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
   *
   * @param client_id The UUID of the client
   * @returns The client if found, null otherwise
   */
  getClient({ client_id }: { client_id: UUID }): Client | null {
    return this._clients.get(client_id) ?? null;
  }

  /**
   *
   * @param client The client to register
   */
  _onClientJoined({ client }: { client: Client }): void {
    this._clients.set(client.uuid, client);
  }

  /**
   *
   * @param client The client to unregister
   */
  _onClientLeft({ client_id }: { client_id: UUID }): void {
    this._clients.delete(client_id);
  }
}

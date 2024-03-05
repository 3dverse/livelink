import { GatewayController } from "./controllers/GatewayController";
import { EditorController } from "./controllers/EditorController";
import { Session } from "./Session";
import type {
  ClientConfig,
  ClientConfigResponse,
  EditorEntity,
  HighlightEntitiesMessage as HighlightEntitiesMessage,
  ScreenSpaceRayQuery,
  ScreenSpaceRayResult,
  Vec2i,
} from "../_prebuild/types/index";
import { Entity } from "./Entity";
import { EntityRegistry } from "./EntityRegistry";

/**
 * The LiveLinkCore interface.
 *
 * This interface must not be embedded and distributed within applications.
 * Instead, applications should embed the 3dverse/livelink.js library,
 * responsible for importing the current library, 3dverse/livelink.core.js.
 *
 * The 3dverse/livelink.js library is versioned and should refer to a specific
 * version of the interface, allowing for interface evolution without breaking
 * compatibility with existing applications.
 */
export class LiveLinkCore extends EventTarget {
  /**
   * Registry of entities discovered until now.
   */
  public readonly entity_registry = new EntityRegistry();

  /**
   * Holds access to the gateway.
   */
  protected readonly _gateway = new GatewayController();

  /**
   * Holds access to the editor.
   */
  protected readonly _editor = new EditorController();

  /**
   * Interval
   */
  private _update_interval = 0;

  /**
   *
   */
  protected constructor(public readonly session: Session) {
    super();
  }

  /**
   * Connect to the session
   */
  protected async _connect(): Promise<LiveLinkCore> {
    // Retrieve a session key
    await this.session.registerClient();
    // Connect to FTL gateway
    console.debug("Connecting to session...", this.session);
    const client = await this._gateway.connectToSession({
      session: this.session,
    });
    console.debug("Connected to session as:", client);

    // Connect to the LiveLink Broker
    await this._editor.connectToSession({ session: this.session, client });
    return this;
  }

  /**
   * Closes the connections to the gateway and the editor.
   */
  protected async close() {
    if (this._update_interval !== 0) {
      clearInterval(this._update_interval);
    }

    await this.session.close();

    this._editor.disconnect();
    this._gateway.disconnect();
  }

  /**
   * Send the configuration requested by the client.
   */
  protected async configureClient({
    client_config,
  }: {
    client_config: ClientConfig;
  }): Promise<ClientConfigResponse> {
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
      throw new Error(
        `Remote canvas size MUST be a multiple of 8, is [${size[0]}, ${size[1]}]`
      );
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
  highlightEntities({
    highlightEntitiesMessage,
  }: {
    highlightEntitiesMessage: HighlightEntitiesMessage;
  }): void {
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
  startUpdateLoop({ fps }: { fps: number }) {
    this._update_interval = setInterval(() => {
      this.entity_registry.advanceFrame({ dt: 1 / fps });

      const updateEntitiesFromJsonMessage =
        this.entity_registry._getEntitiesToUpdate();
      if (updateEntitiesFromJsonMessage !== null) {
        this._gateway.updateEntities({ updateEntitiesFromJsonMessage });
        this.entity_registry._clearDirtyList();
      }
    }, 1000 / fps);
  }
}

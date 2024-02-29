import { GatewayController } from "./controllers/GatewayController";
import { EditorController } from "./controllers/EditorController";
import { Session } from "./Session";
import type {
  ClientConfig,
  ClientConfigResponse,
  EditorEntity,
  HighlightEntitiesQuery,
  RTID,
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
 * Instead, applications should embed the @3dverse/livelink.js library,
 * responsible for importing the current library, @3dverse/livelink.core.js.
 * The @3dverse/livelink.js library is versioned and should refer to a specific
 * version of the interface, allowing for interface evolution without breaking
 * compatibility with existing applications.
 */
export class LiveLinkCore extends EventTarget {
  /**
   *
   */
  public readonly entity_registry = new EntityRegistry(this);
  /**
   *
   */
  protected readonly _gateway = new GatewayController();

  /**
   *
   */
  protected readonly _editor = new EditorController();

  /**
   *
   */
  protected constructor(public readonly session: Session) {
    super();
  }

  /**
   *
   */
  async close() {
    await this.session.close();
    this._gateway.disconnect();
    this._editor.disconnect();
    if (this._update_interval !== 0) {
      clearInterval(this._update_interval);
    }
  }

  /**
   *
   */
  async configureClient({
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
  resize({ size }: { size: Vec2i }) {
    this._checkRemoteCanvasSize({ size });
    this._gateway.resize({ size });
  }

  /**
   *
   */
  protected async _connect(): Promise<LiveLinkCore> {
    // Generate a client UUID and retrieve a session key
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
    highlightEntitiesQuery,
  }: {
    highlightEntitiesQuery: HighlightEntitiesQuery;
  }): void {
    this._gateway.highlightEntities({ highlightEntitiesQuery });
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
  private _dirty_entities = new Map<string, Array<Entity>>();
  private _update_interval = 0;
  addEntityToUpdate({ entity }: { entity: Entity }) {
    //this._dirty_entities.get("local_transform").push(entity);
    this._gateway.updateEntities({
      component_name: "local_transform",
      entities: [entity],
    });
  }
  startUpdateLoop() {
    this._dirty_entities.set("local_transform", new Array<Entity>());
    this._update_interval = setInterval(() => {
      for (const [k, v] of this._dirty_entities) {
        if (v.length !== 0) {
          this._gateway.updateEntities({
            component_name: "local_transform",
            entities: v,
          });
          v.length = 0;
        }
      }
    }, 40);
  }
}

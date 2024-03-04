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
import { ComponentHash } from "../_prebuild/types/components";

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
  protected readonly _gateway = new GatewayController();

  /**
   *
   */
  protected readonly _editor = new EditorController();

  /**
   *
   */
  public readonly entity_registry = new EntityRegistry(this);

  /**
   *
   */
  protected constructor(public readonly session: Session) {
    super();

    this._dirty_entities.set("local_transform", new Set<Entity>());
    this._dirty_entities.set("perspective_lens", new Set<Entity>());
    this._dirty_entities.set("camera", new Set<Entity>());
  }

  /**
   *
   */
  protected async close() {
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
  private _dirty_entities = new Map<string, Set<Entity>>();
  private _update_interval = 0;
  addEntityToUpdate({
    component,
    entity,
  }: {
    component: string;
    entity: Entity;
  }) {
    this._dirty_entities.get(component).add(entity);
  }
  /**
   *
   */
  static previous = Date.now();
  startUpdateLoop({ fps }: { fps: number }) {
    this._update_interval = setInterval(() => {
      this.entity_registry.advanceFrame({ dt: 1 / fps });

      const updateEntitiesFromJsonMessage = { components: [] };

      for (const [component_name, entities] of this._dirty_entities) {
        if (entities.size !== 0) {
          updateEntitiesFromJsonMessage.components =
            updateEntitiesFromJsonMessage.components ?? [];
          updateEntitiesFromJsonMessage.components.push({
            component_name,
            entities,
          });
        }
      }

      if (updateEntitiesFromJsonMessage.components.length > 0) {
        this._gateway.updateEntities({ updateEntitiesFromJsonMessage });
      }

      for (const [_, entities] of this._dirty_entities) {
        entities.clear();
      }
    }, 1000 / fps);
  }
}

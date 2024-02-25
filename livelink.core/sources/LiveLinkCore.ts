import { GatewayController } from "./controllers/GatewayController";
import { LiveLinkController } from "./controllers/LiveLinkController";
import { Session } from "./Session";
import type {
  ClientConfig,
  CodecType,
  EditorEntity,
  ScreenSpaceRayQuery,
  Vec2i,
} from "../_prebuild/types/index";
import { Entity } from "./Entity";

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
  protected readonly _broker = new LiveLinkController();

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
    this._broker.disconnect();
  }

  private _previous_multiple_of_8 = (n: number) =>
    Math.floor(n) - (Math.floor(n) % 8);

  /**
   *
   */
  async configureClientAux({
    client_config,
  }: {
    client_config: ClientConfig;
  }): Promise<CodecType> {
    client_config.rendering_area_size[0] = this._previous_multiple_of_8(
      client_config.rendering_area_size[0] * window.devicePixelRatio
    );
    client_config.rendering_area_size[1] = this._previous_multiple_of_8(
      client_config.rendering_area_size[1] * window.devicePixelRatio
    );

    const res = await this._gateway.configureClient({ client_config });
    return res.codec;
  }

  /**
   *
   */
  resizeAux({ size }: { size: Vec2i }) {
    size[0] = this._previous_multiple_of_8(size[0] * window.devicePixelRatio);
    size[1] = this._previous_multiple_of_8(size[1] * window.devicePixelRatio);
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
    await this._broker.connectToSession({ session: this.session, client });
    return this;
  }

  /**
   *
   */
  async castScreenSpaceRay({
    screenSpaceRayQuery,
  }: {
    screenSpaceRayQuery: ScreenSpaceRayQuery;
  }) {
    return this._gateway.castScreenSpaceRay({ screenSpaceRayQuery });
  }

  /**
   *
   */
  async createEntity({ entity }: { entity: Entity }): Promise<EditorEntity> {
    const entities = await this._broker.spawnEntity({ entity });
    return entities[0];
  }
}

import { GatewayController } from "./controllers/GatewayController";
import { LiveLinkController } from "./controllers/LiveLinkController";
import { Session } from "./Session";
import { ClientConfig, CodecType, Vec2i } from "../_prebuild/types/index";

/**
 * The LiveLinkCore interface.
 *
 * This interface MUST NOT be embedded and distributed inside applications.
 * The application SHOULD embedd the @3dverse/livelink.js library that is
 * responsible for importing the current library - @3dverse/livelink.core.js.
 * @3dverse/livelink.js is versionned and MUST refer to a version to the
 * interface so that we can evolve the said interface without breaking
 * compatibility with the existing applications.
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
    await this.session.createClient();
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
}

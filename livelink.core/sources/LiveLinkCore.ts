import { GatewayController } from "./controllers/GatewayController";
import { LiveLinkController } from "./controllers/LiveLinkController";
import { FrameDecoder } from "./decoders/FrameDecoder";
import { SoftwareDecoder } from "./decoders/SoftwareDecoder";
import { WebCodecsDecoder } from "./decoders/WebCodecsDecoder";
import { Session, SessionInfo, SessionSelector } from "./Session";
import { ClientConfig, UUID, Vec2i } from "../_prebuild/types/index";

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
   * Start a session with the given scene id
   *
   * @param {Object}  obj
   * @param {UUID}    obj.scene_id  The id of the scene to start
   * @param {string}  obj.token     The public access token or the user token
   *                                which must have at least read access to the
   *                                scene
   *
   * @returns {Promise<LiveLinkCore>}   A promise to a LiveLink instance holding a
   *                                session with the specified scene
   *
   * @throws {Error} Session isues
   * @throws {Error} Gateway issues
   * @throws {Error} SEB issues
   */
  static async start({
    scene_id,
    token,
  }: {
    scene_id: UUID;
    token: string;
  }): Promise<LiveLinkCore> {
    console.debug(`Starting new session on scene '${scene_id}'`);
    const session = await new Session(scene_id, token).create();
    return await LiveLinkCore.join({ session });
  }

  /**
   *
   */
  static async join_or_start({
    scene_id,
    token,
    session_selector = ({ sessions }: { sessions: Array<SessionInfo> }) =>
      sessions[0],
  }: {
    scene_id: UUID;
    token: string;
    session_selector: SessionSelector;
  }): Promise<LiveLinkCore> {
    console.debug(`Looking for sessions on scene '${scene_id}'`);
    const session = await new Session(scene_id, token).find({
      session_selector,
    });

    if (session === null) {
      console.debug(
        `There's no session currently running on scene '${scene_id}' and satisfiying the provided selector criteria`
      );
      return await LiveLinkCore.start({ scene_id, token });
    }

    try {
      console.debug("Found session, joining...", session);
      return await LiveLinkCore.join({ session });
    } catch {
      console.error(
        `Failed to join session '${session.session_id}', trying again with another session.`
      );

      return await LiveLinkCore.join_or_start({
        scene_id,
        token,
        // Do not try to connect to the faulty session again.
        session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) => {
          sessions = sessions.filter(
            (s) => s.session_id !== session.session_id
          );
          return session_selector({ sessions });
        },
      });
    }
  }

  /**
   *
   */
  static async join({ session }: { session: Session }): Promise<LiveLinkCore> {
    console.debug("Joining session:", session);
    return await new LiveLinkCore(session)._connect();
  }

  /**
   *
   */
  private readonly _broker = new LiveLinkController();

  /**
   *
   */
  readonly _gateway = new GatewayController();

  /**
   *
   */
  private constructor(public readonly session: Session) {
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
  async configureClient({ client_config }: { client_config: ClientConfig }) {
    client_config.rendering_area_size[0] = this._previous_multiple_of_8(
      client_config.rendering_area_size[0] * window.devicePixelRatio
    );
    client_config.rendering_area_size[1] = this._previous_multiple_of_8(
      client_config.rendering_area_size[1] * window.devicePixelRatio
    );

    const res = await this._gateway.configureClient({ client_config });
  }

  /**
   *
   */
  resize({ size }: { size: Vec2i }) {
    size[0] = this._previous_multiple_of_8(size[0] * window.devicePixelRatio);
    size[1] = this._previous_multiple_of_8(size[1] * window.devicePixelRatio);
    this._gateway.resize({ size });
  }

  /**
   *
   */
  private async _connect(): Promise<LiveLinkCore> {
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

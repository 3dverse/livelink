import { GatewayController } from "./controllers/GatewayController.js";
import { LiveLinkController } from "./controllers/LiveLinkController.js";
import { FrameDecoder } from "./decoders/FrameDecoder.js";
import { SoftwareDecoder } from "./decoders/SoftwareDecoder.js";
import { WebCodecsDecoder } from "./decoders/WebCodecsDecoder.js";
import { Session, SessionInfo, SessionSelector } from "./Session.js";
import { ClientConfig, UUID, Vec2i } from "../_prebuild/types/index";

/**
 * The LiveLink interface.
 *
 * This interface MUST NOT be embedded and distributed inside applications.
 * The application SHOULD embedd the @3dverse/livelink.js library that is
 * responsible for importing the current library - @3dverse/livelink.core.js.
 * @3dverse/livelink.js is versionned and MUST refer to a version to the
 * interface so that we can evolve the said interface without breaking
 * compatibility with the existing applications.
 */
export class LiveLink extends EventTarget {
  /**
   * Singleton instance
   */
  private static _instance: LiveLink | null = null;
  static get instance() {
    return LiveLink._instance;
  }

  /**
   * Start a session with the given scene id
   *
   * @param {Object}  obj
   * @param {UUID}    obj.scene_id  The id of the scene to start
   * @param {string}  obj.token     The public access token or the user token
   *                                which must have at least read access to the
   *                                scene
   *
   * @returns {Promise<LiveLink>}   A promise to a LiveLink instance holding a
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
  }): Promise<LiveLink> {
    console.debug(`Starting new session on scene '${scene_id}'`);
    const session = await new Session(scene_id, token).create();
    return await LiveLink.join({ session });
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
  }): Promise<LiveLink> {
    console.debug(`Looking for sessions on scene '${scene_id}'`);
    const session = await new Session(scene_id, token).find({
      session_selector,
    });

    if (session === null) {
      console.debug(
        `There's no session currently running on scene '${scene_id}' and satisfiying the provided selector criteria`
      );
      return await LiveLink.start({ scene_id, token });
    }

    try {
      console.debug("Found session, joining...", session);
      return await LiveLink.join({ session });
    } catch {
      console.error(
        `Failed to join session '${session.session_id}', trying again with another session.`
      );

      return await LiveLink.join_or_start({
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
  static async join({ session }: { session: Session }): Promise<LiveLink> {
    console.debug("Joining session:", session);
    LiveLink._instance = await new LiveLink(session)._connect();
    return LiveLink._instance;
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
   * Video decoder that decodes the frames received from the remote viewer.
   */
  private _decoder: FrameDecoder | null = null;

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
    LiveLink._instance = null;
  }

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

    this._createDecoder({ client_config });

    const res = await this._gateway.configureClient({ client_config });

    await this._decoder!.configure({ codec: res.codec });
  }

  private _previous_multiple_of_8 = (n: number) =>
    Math.floor(n) - (Math.floor(n) % 8);

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
  private async _connect(): Promise<LiveLink> {
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

  /**
   *
   */
  private async _createDecoder({
    client_config,
    decoder_type = "webcodecs",
  }: {
    client_config: ClientConfig;
    decoder_type?: "webcodecs" | "broadway";
  }) {
    this._decoder =
      decoder_type === "webcodecs"
        ? new WebCodecsDecoder(
            client_config.rendering_area_size,
            client_config.canvas_context
          )
        : new SoftwareDecoder(
            client_config.rendering_area_size,
            client_config.canvas_context
          );

    this._gateway.addEventListener("on-frame-received", (e) => {
      const event = e as CustomEvent;
      this._decoder!.decodeFrame({
        encoded_frame: event.detail.encoded_frame,
      });
    });
  }

  /**
   *
   */
  async createDefaultCamera() {
    console.log("Creating default camera");
    const camera = (
      await this._broker.spawnEntity({
        components: {
          camera: {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: true, skybox: false, gradient: true },
          },
          perspective_lens: {},
          local_transform: { position: [0, 2, 5] },
          debug_name: { value: "MyCam" },
        },
      })
    )[0] as { rtid: string };

    const camera_rtid = BigInt(camera.rtid);
    this._gateway.setViewports({
      viewports: [
        {
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          camera_rtid,
        },
      ],
    });

    this._gateway.resume();

    return camera_rtid;
  }
}

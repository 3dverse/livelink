import { ClientConfig, UUID, Vec2i } from "../_prebuild/types.js";
import { Session, SessionInfo, SessionSelector } from "./Session.js";
import { GatewayController } from "./controllers/GatewayController.js";
import { LiveLinkController } from "./controllers/LiveLinkController.js";

/**
 *
 */
export class LiveLink extends EventTarget {
  /**
   * Singleton instance
   */
  private static _instance: LiveLink;
  static get instance() {
    return LiveLink._instance;
  }

  /**
   * Start a session with the given scene id
   *
   * @param {Object} obj
   * @param {UUID} obj.scene_id The id of the scene to start
   * @param {string} obj.token The public access token or the user token which must have at least read access to the scene
   *
   * @returns {Promise<LiveLink>} A promise to a LiveLink instance holding a session with the specified scene
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
  private _broker = new LiveLinkController();

  /**
   *
   */
  private _gateway = new GatewayController();

  /**
   *
   */
  private constructor(private readonly _session: Session) {
    super();
  }

  /**
   *
   */
  get session() {
    return this._session;
  }

  /**
   *
   */
  async close() {
    await this._session.close();
    this._gateway.disconnect();
    this._broker.disconnect();
  }

  /**
   *
   */
  startStreaming({ client_config }: { client_config: ClientConfig }) {
    client_config.rendering_area_size[0] = this._previous_multiple_of(
      this.MULTIPLE,
      client_config.rendering_area_size[0] * window.devicePixelRatio
    );
    client_config.rendering_area_size[1] = this._previous_multiple_of(
      this.MULTIPLE,
      client_config.rendering_area_size[1] * window.devicePixelRatio
    );

    this._gateway.configureClient({
      client_config,
    });
  }

  private MULTIPLE = 8;
  private _previous_multiple_of = (m: number, n: number) =>
    Math.floor(n) - (Math.floor(n) % m);

  /**
   *
   */
  resize({ size }: { size: Vec2i }) {
    size[0] = this._previous_multiple_of(
      this.MULTIPLE,
      size[0] * window.devicePixelRatio
    );
    size[1] = this._previous_multiple_of(
      this.MULTIPLE,
      size[1] * window.devicePixelRatio
    );
    this._gateway.resize({ size });
    this.dispatchEvent(new Event("resize"));
  }

  /**
   *
   */
  private async _connect(): Promise<LiveLink> {
    // Generate a client UUID and retrieve a session key
    await this._session.createClient();
    // Connect to FTL gateway
    console.debug("Connecting to session...", this._session);
    const client = await this._gateway.connectToSession({
      session: this._session,
    });
    console.debug("Connected to session as: ", client);

    // Connect to the LiveLink Broker
    await this._broker.connectToSession({ session: this._session, client });
    return this;
  }

  /**
   *
   */
  async createDefaultCamera() {
    console.log("Creating default camera");
    const cameras = (await this._broker.createEntity({
      components: {
        camera: {
          renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
          dataJSON: { grid: true, skybox: true, gradient: false },
        },
        perspective_lens: { aspectRatio: 1 },
        local_transform: { position: [0, 2, -10] },
        debug_name: { value: "MyCam" },
      },
    })) as Array<{ rtid: string }>;

    this._gateway.setViewports({
      viewports: [
        {
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          camera_rtid: Number.parseInt(cameras[0].rtid),
        },
      ],
    });

    this._gateway.resume();
  }
}

/**
 * Mixin
export interface LiveLink extends LiveLinkController, GatewayController {}

function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
        Object.create(null)
        );
      });
    });
  }
  applyMixins(LiveLink, [LiveLinkController, GatewayController]);

  */

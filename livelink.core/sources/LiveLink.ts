import { ClientConfig, UUID, Vec2i } from "../_prebuild/types.js";
import { Session } from "./Session.js";
import { GatewayController } from "./controllers/GatewayController.js";
import { LiveLinkController } from "./controllers/LiveLinkController.js";

/**
 *
 */
export class LiveLink {
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
    session_selector,
  }: {
    scene_id: UUID;
    token: string;
    session_selector?: (sessions: Array<{ session_id: UUID }>) => {
      session_id: UUID;
    };
  }): Promise<LiveLink> {
    const session = await new Session(scene_id, token).find({
      session_selector,
    });
    if (session === null) {
      // There's no session currently running with the provided scene, start a new one
      return await LiveLink.start({ scene_id, token });
    }

    try {
      return await LiveLink.join({ session });
    } catch {
      // An error occurred while connecting to the selected existing session,
      // try again with potentially another one.
      // If need be we can encapsulate the session_selector function and add a pass that removes
      // the faulty session:
      // session_selector: (sessions: Array<{ session_id: UUID }>) => {
      //   sessions = sessions.session_selector((s) => {
      //     return s.session_id !== session.session_id;
      //   });
      //   return session_selector(sessions);
      // };
      return await LiveLink.join_or_start({
        scene_id,
        token,
        session_selector,
      });
    }
  }

  /**
   *
   */
  static async join({ session }: { session: Session }): Promise<LiveLink> {
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
  private constructor(private readonly _session: Session) {}

  /**
   *
   */
  get session() {
    return this._session;
  }

  /**
   *
   */
  close() {
    this._session.close();
  }

  /**
   *
   */
  startStreaming({ client_config }: { client_config: ClientConfig }) {
    client_config.rendering_area_size[0] = this._previous_multiple_of(
      this.MULTIPLE,
      client_config.rendering_area_size[0]
    );
    client_config.rendering_area_size[1] = this._previous_multiple_of(
      this.MULTIPLE,
      client_config.rendering_area_size[1]
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
    size[0] = this._previous_multiple_of(this.MULTIPLE, size[0]);
    size[1] = this._previous_multiple_of(this.MULTIPLE, size[1]);
    this._gateway.resize({ size });
    console.log("Resizing to", size);
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

    // Connent LiveLink Broker
    await this._broker.connect({ session: this._session, client });
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

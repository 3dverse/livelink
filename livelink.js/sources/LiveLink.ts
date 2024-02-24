import {
  LiveLinkCore,
  Session,
  ClientConfig,
  SessionInfo,
  UUID,
  Vec2i,
  SessionSelector,
  ScreenSpaceRayQuery,
  FrameData,
} from "@livelink.core";

import type { FrameDecoder } from "./decoders/FrameDecoder";
import { WebCodecsDecoder } from "./decoders/WebCodecsDecoder";
import { SoftwareDecoder } from "./decoders/SoftwareDecoder";
import { Entity } from "./Entity";
import { Viewport } from "./Viewport";

/**
 * The LiveLink interface.
 *
 * This interface CAN be embedded and distributed inside applications.
 */
export class LiveLink extends LiveLinkCore {
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
    LiveLink._instance = new LiveLink(session);
    await LiveLink._instance._connect();
    return LiveLink._instance;
  }

  /**
   * Video decoder that decodes the frames received from the remote viewer.
   */
  private _decoder: FrameDecoder | null = null;

  /**
   *
   */
  private constructor(public readonly session: Session) {
    super(session);
  }

  /**
   *
   */
  async close() {
    await super.close();
  }

  /**
   *
   */
  async configureClient({ client_config }: { client_config: ClientConfig }) {
    await this._createDecoder({ client_config });

    const codec = await super.configureClientAux({ client_config });

    await this._decoder!.configure({ codec });
  }

  /**
   *
   */
  resize({ size }: { size: Vec2i }) {
    super.resizeAux({ size });
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
      const event = e as CustomEvent<FrameData>;
      this._decoder!.decodeFrame({
        encoded_frame: event.detail.encoded_frame,
      });
    });
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
  async createEntity({ components }: { components: Entity }): Promise<Entity> {
    const entities = await this._broker.spawnEntity({ components });
    return new Entity(entities[0]);
  }

  /**
   *
   */
  setViewports({ viewports }: { viewports: Array<Viewport> }) {
    this._gateway.setViewports({
      viewports: viewports.map((v) => v.config),
    });
  }

  /**
   *
   */
  resume() {
    this._gateway.resume();
  }

  /**
   *
   */
  suspend() {
    this._gateway.suspend();
  }
}

import {
  LiveLinkCore,
  Session,
  ClientConfig,
  SessionInfo,
  UUID,
  Vec2i,
  SessionSelector,
  FrameData,
  Entity,
  CodecType,
} from "@livelink.core";

import type { FrameDecoder } from "./decoders/FrameDecoder";
import { Viewport } from "./Viewport";
import { Camera } from "./Camera";

/**
 * The LiveLink interface.
 *
 * This interface CAN be embedded and distributed inside applications.
 */
export class LiveLink extends LiveLinkCore {
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
    const inst = new LiveLink(session);
    await inst._connect();
    return inst;
  }

  /**
   *
   */
  private _codec: CodecType | null = null;
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
    const res = await super.configureClient({ client_config });
    this._codec = res.codec;
    return res;
  }

  /**
   *
   */
  resize({ size }: { size: Vec2i }) {
    super.resize({ size });
  }

  /**
   *
   */
  async configureDecoder<DecoderType extends FrameDecoder>(
    decoder_type: {
      new (_1: Vec2i, _2: CanvasRenderingContext2D): DecoderType;
    },
    {
      rendering_area_size,
      canvas_context,
    }: {
      rendering_area_size: Vec2i;
      canvas_context: CanvasRenderingContext2D;
    }
  ) {
    if (this._codec === null) {
      throw new Error("Client not configured.");
    }

    this._decoder = await new decoder_type(
      rendering_area_size,
      canvas_context
    ).configure({ codec: this._codec });

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
  newEntity<T extends Entity>(
    type: { new (_: LiveLinkCore): T },
    name: string
  ): T {
    return new type(this).init(name);
  }

  /**
   *
   */
  async findEntity({
    entity_uuid,
  }: {
    entity_uuid: UUID;
  }): Promise<Camera | null> {
    const editor_entities = await this._editor.findEntitiesByEUID({
      entity_uuid,
    });
    if (editor_entities.length === 0) {
      return null;
    }
    return new Camera(this).init(editor_entities[0]);
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

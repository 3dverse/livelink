import { GatewayConnection } from "../../_prebuild/GatewayConnection.js";
import { GatewayRequestSender } from "../../_prebuild/GatewayRequestSender.js";
import { GatewayMessageHandler } from "../../_prebuild/GatewayMessageHandler.js";
import { HEARTBEAT_PERIOD_IN_MS } from "../../_prebuild/constants.js";
import {
  AuthenticationStatus,
  ClientConfig,
  CodecType,
  FrameMetaData,
  RTID,
  UUID,
  Vec2,
  Vec3,
} from "../../_prebuild/types.js";

import { FrameDecoder } from "../decoders/FrameDecoder.js";
import { SoftwareDecoder } from "../decoders/SoftwareDecoder.js";
import { WebCodecsDecoder } from "../decoders/WebCodecsDecoder.js";

import { Session } from "../Session.js";
import { Client } from "../Client.js";

/**
 * The gateway controller is the exposed interface of the LiveLink gateway
 * protocol.
 */
export class GatewayController implements GatewayMessageHandler {
  /**
   * Connection to the gateway.
   */
  private readonly _connection = new GatewayConnection();

  /**
   * Request sender that offers a list of available requests that can be sent
   * to the gateway.
   */
  private readonly _req = new GatewayRequestSender(this._connection);
  get req() {
    return this._req;
  }

  /**
   * Timeout that sends a hearbeat to the gateway to maintain the connection
   * alive.
   * Note that the gateway should answer us back.
   */
  private _heartbeat_timeout_id: number = 0;

  /**
   * Timestamp of the last sent heartbeat.
   * Using the answer of the gateway, we can compute the latency of the
   * connection.
   */
  private _heartbeat_sent_at: number = 0;

  /**
   * Video decoder that decodes the frames received from the remote viewer.
   */
  private _decoder: FrameDecoder | null = null;

  /**
   * The callbacks to trigger once we receive the authentication response
   * from the gateway.
   */
  private _authentication_promise_callbacks: {
    resolve: (client: Client) => void;
    reject: (reason?: any) => void;
  } | null = null;

  /**
   * Opens a connection to the gateway where the provided session is running.
   *
   * @returns {Promise<Client>} The created client representing the current
   *                            user encoded `in session.session_key`
   * @throws {InvalidSession}   Thrown if the provided session is invalid
   */
  async connectToSession({ session }: { session: Session }): Promise<Client> {
    if (!session.isValid()) {
      throw new Error("Invalid session");
    }

    await this._connection.connect({
      gateway_url: session.gateway_url!,
      handler: this,
    });

    return new Promise<Client>((resolve, reject) => {
      // Save the callbacks before sending the request.
      this._authentication_promise_callbacks = { resolve, reject };

      this._req.authenticateClient({
        session_auth: {
          session_key: session.session_key!,
          client_app: navigator.userAgent,
          os: navigator.platform,
        },
      });
    });
  }

  /**
   * Closes the connection to the gateway.
   */
  disconnect(): void {
    if (this._heartbeat_timeout_id > 0) {
      clearTimeout(this._heartbeat_timeout_id);
      this._heartbeat_timeout_id = 0;
    }

    this._connection.disconnect();
  }

  /**
   * Response to the authentication request.
   * If the status is not successful, rejects the saved promise.
   *
   * @throws {PromiseNotSet}  Throws if the promise wasn't properly set before
   *                          sending the authentication request.
   */
  on_authenticateClient_response({
    status,
    client_id,
  }: {
    status: AuthenticationStatus;
    client_id: UUID;
  }): void {
    if (this._authentication_promise_callbacks === null) {
      throw new Error("Promise not set");
    }

    if (status !== AuthenticationStatus.success) {
      this._authentication_promise_callbacks.reject(
        `Authentication failed: ${AuthenticationStatus[status]}`
      );
    }

    // The authentication has been successful, start pulsing the heartbeat
    // right away to maintain the connection alive.
    this._pulseHeartbeat();

    // We're good to go, the gateway provided us with a client id so we can
    // connect to the LiveLink broker.
    this._authentication_promise_callbacks.resolve(new Client(client_id));
  }

  /**
   * Sends a heartbeat to the cluster gateway at a constant frequency
   * to signify that the client is still alive.
   */
  private _pulseHeartbeat(): void {
    this._heartbeat_timeout_id = setTimeout(() => {
      this._req.pulseHeartbeat();
      this._heartbeat_sent_at = Date.now();
    }, HEARTBEAT_PERIOD_IN_MS);
  }

  /**
   * The cluster gateway's response to our heartbeat.
   * Note that it doesn't have any data.
   */
  on_pulseHeartbeat_response(): void {
    if (this._heartbeat_sent_at === 0) {
      console.warn("Received an unsolicited heartbeat");
    }

    // This effectively computes how long it takes to round-trip
    // between the client and the cluster gateway.
    const latency = Date.now() - this._heartbeat_sent_at;
    this._heartbeat_sent_at = 0;

    this._pulseHeartbeat();
  }

  /**
   *
   */
  configureClient({
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

    this._req.configureClient({ client_config });
  }

  /**
   *
   */
  async on_configureClient_response({
    codec,
  }: {
    codec: CodecType;
  }): Promise<void> {
    if (this._decoder === null) {
      throw new Error("Missing video decoder");
    }
    await this._decoder.configure({ codec });
  }

  /**
   *
   */
  on_resize_response({ size }: { size: Vec2 }): void {
    console.log("Resized to:", size);
  }

  /**
   *
   */
  onFrameReceived({
    encoded_frame_size,
    meta_data_size,
    encoded_frame,
    meta_data,
  }: {
    encoded_frame_size: number;
    meta_data_size: number;
    encoded_frame: DataView;
    meta_data: FrameMetaData;
  }): void {
    this._decoder!.decodeFrame({ encoded_frame });
  }

  /**
   *
   */
  on_castScreenSpaceRay_response({
    entity_rtid,
    position,
    normal,
  }: {
    entity_rtid: RTID;
    position: Vec3;
    normal: Vec3;
  }): void {
    throw new Error("Method not implemented.");
  }
}

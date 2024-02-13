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
import { Session } from "../Session.js";
import { WebCodecsDecoder } from "../decoders/WebCodecsDecoder.js";
import { Client } from "../Client.js";
import { SoftwareDecoder } from "../decoders/SoftwareDecoder.js";

/**
 *
 */
export class GatewayController
  extends GatewayRequestSender
  implements GatewayMessageHandler
{
  /**
   *
   */
  private _heartbeat_timeout_id: number = 0;
  private _heartbeat_sent_at: number = 0;
  //private _decoder: FrameDecoder = new SoftwareDecoder();
  private _decoder: FrameDecoder = new WebCodecsDecoder();
  private _client_config: ClientConfig | null = null;
  private _authentication_promise_callbacks: {
    resolve: (client: Client) => void;
    reject: (reason?: any) => void;
  } | null = null;

  /**
   *
   */
  async connectToSession({ session }: { session: Session }): Promise<Client> {
    if (session.gateway_url === null || session.session_key === null) {
      throw new Error("Invalid params");
    }

    await this._cluster_gateway_connection.connect({
      gateway_url: session.gateway_url,
      handler: this,
    });

    console.debug("Connected to gateway:", session.gateway_url);

    return new Promise<Client>((resolve, reject) => {
      this._authentication_promise_callbacks = { resolve, reject };
      this.authenticateClient({
        session_auth: {
          session_key: session.session_key!,
          client_app: navigator.userAgent,
          os: navigator.platform,
        },
      });
    });
  }

  /**
   *
   */
  disconnect(): void {
    if (this._heartbeat_timeout_id > 0) {
      clearTimeout(this._heartbeat_timeout_id);
      this._heartbeat_timeout_id = 0;
    }
  }

  /**
   *
   */
  on_authenticateClient_response({
    status,
    client_id,
  }: {
    status: AuthenticationStatus;
    client_id: UUID;
  }): void {
    if (status !== AuthenticationStatus.success) {
      //throw new Error(`Authentication failed: ${AuthenticationStatus[status]}`);
      this._authentication_promise_callbacks?.reject();
    }

    this._pulseHeartbeat();

    this._authentication_promise_callbacks?.resolve(new Client(client_id));
  }

  /**
   * Sends a heartbeat to the cluster gateway at a constant frequency
   * to signify that the client is still alive.
   */
  private _pulseHeartbeat(): void {
    this._heartbeat_timeout_id = setTimeout(() => {
      this.pulseHeartbeat();
      this._heartbeat_sent_at = Date.now();
    }, HEARTBEAT_PERIOD_IN_MS);
  }

  /**
   * The cluster gateway's response to our heartbeat.
   * Note that it doesn't contain any data.
   */
  on_pulseHeartbeat_response(): void {
    if (this._heartbeat_sent_at === 0) {
      console.warn("Unsolicited heartbeat");
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
  configureClient({ client_config }: { client_config: ClientConfig }) {
    this._client_config = client_config;
    super.configureClient({ client_config });
  }

  /**
   *
   */
  async on_configureClient_response({
    codec,
  }: {
    codec: CodecType;
  }): Promise<void> {
    if (this._client_config === null) {
      throw new Error("No client config");
    }

    await this._decoder.configure({
      codec,
      dimensions: this._client_config.rendering_area_size,
      canvas_context: this._client_config.canvas_context,
    });
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
    this._decoder.decodeFrame({ encoded_frame });
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

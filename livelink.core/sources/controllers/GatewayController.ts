import { HEARTBEAT_PERIOD_IN_MS } from "../../_prebuild/constants.js";
import { AuthenticationStatus, FrameData } from "../../_prebuild/types/index";
import { GatewayMessageHandler } from "../../_prebuild/GatewayMessageHandler";

import { Session } from "../Session.js";
import { Client } from "../Client.js";

/**
 * The gateway controller is the exposed interface of the LiveLink gateway
 * protocol.
 * It's the object responsible of providing access to any request message the
 * gateway exposes. Moreover it's also responsible for handling the responses
 * to requests.
 */
export class GatewayController extends GatewayMessageHandler {
  /**
   * Timeout that sends a hearbeat to the gateway to maintain the connection
   * alive. Note that the gateway should answer us back.
   */
  private _heartbeat_timeout_id: number = 0;

  /**
   * Timestamp of the last sent heartbeat.
   * Using the answer of the gateway, we can compute the latency of the
   * connection.
   */
  private _heartbeat_sent_at: number = 0;

  /**
   * Opens a connection to the gateway where the provided session is running.
   *
   * @returns {Promise<Client>}     The created client representing the current
   *                                user encoded `in session.session_key`.
   *
   * @throws {InvalidSession}       Thrown if the provided session is not valid.
   *
   * @throws {AuthenticationFailed} Thrown if the authentication to the gateway
   *                                fails and provides the reason.
   */
  async connectToSession({ session }: { session: Session }): Promise<Client> {
    if (!session.isValid()) {
      throw new Error("Invalid session");
    }

    await this._connection.connect({
      gateway_url: session.gateway_url!,
      handler: this,
    });

    const authRes = await this.authenticateClient({
      session_auth: {
        session_key: session.session_key!,
        client_app: navigator.userAgent,
        os: navigator.platform,
      },
    });

    if (authRes.status !== AuthenticationStatus.success) {
      throw new Error(
        `Authentication failed: ${AuthenticationStatus[authRes.status]}`
      );
    }

    // The authentication has been successful, start pulsing the heartbeat
    // right away to maintain the connection alive.
    this._pulseHeartbeat();

    // We're good to go, the gateway provided us with a client id so we can
    // connect to the LiveLink broker.
    return new Client(authRes.client_id);
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
   * Sends a heartbeat to the cluster gateway at a constant frequency
   * to signify that the client is still alive.
   */
  private _pulseHeartbeat(): void {
    this._heartbeat_timeout_id = setTimeout(async () => {
      this._heartbeat_sent_at = Date.now();
      await this.pulseHeartbeat();

      // This effectively computes how long it takes to round-trip
      // between the client and the cluster gateway.
      const latency = Date.now() - this._heartbeat_sent_at;
      this._heartbeat_sent_at = 0;

      this._pulseHeartbeat();
    }, HEARTBEAT_PERIOD_IN_MS);
  }

  /**
   *
   */
  onFrameReceived({ frame_data }: { frame_data: FrameData }): void {
    this.dispatchEvent(
      new CustomEvent("on-frame-received", { detail: frame_data })
    );
  }
}

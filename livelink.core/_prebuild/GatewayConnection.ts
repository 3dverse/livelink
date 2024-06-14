/**
 * DO NOT EDIT THIS FILE MANUALLY.
 * This file has been generated automatically from its AsyncAPI spec file.
 * See : https://gitlab.com/3dverse/platform/libs/js/asyncapi-server-generator
 */

import { GatewayMessageHandler } from "./GatewayMessageHandler";
import { FTL_HEADER_SIZE, LITTLE_ENDIAN } from "../sources/types/constants";
import { UUID_BYTE_SIZE, deserialize_UUID } from "../sources/types";
import { ChannelId } from "./messages/gateway/enums";

/**
 * Holds the connection to the cluster gateway hosting the renderer
 * and the viewer handling the session.
 *
 *                     ┌─────────┬──────────────┐
 *                     │         │              │
 *                     │         │ ┌──────────┐ │
 *                     │         │ │ Renderer │ │
 *                     │         │ └─────┬────┘ │
 *    ┌────────┐       │         │       │      │
 *    │ Client │◄──────► Gateway ◄───────┤      │
 *    └────────┘       │         │       │      │
 *                 ▲   │         │  ┌────┴───┐  │
 *                 |   │         │  │ Viewer │  │
 * GatewayConnection   │         │  └────────┘  │
 *                     │         │              │
 *                     └─────────┴──────────────┘
 *
 * Responsibilities of this class are threefold:
 *  - Open, maintain, and handle any error in the connection to the gateway.
 *
 *  - Apply the authentication protocol when the first message is received.
 *    Note that initiating the authentication doesn't fall under this class's
 *    purview.
 *
 *  - Demultiplex messages following the gateway Livelink Protocol.
 *    It is only responsible for deserializing the multiplexer binary header
 *    data according to the Livelink protocol specifications; in no case is it
 *    supposed to apply any kind of logic beyond routing messages to the
 *    appropriate handler.
 */
export class GatewayConnection {
    /**
     * Socket connected to the cluster gateway.
     */
    private _socket: WebSocket | null = null;

    /**
     * Controller responsible for handling messages coming from the gateway.
     */
    private _handler: GatewayMessageHandler | null = null;

    /**
     * Opens a connection to the gateway.
     *
     * @throws {Error} Socket errors
     */
    async connect({ gateway_url, handler }: { gateway_url: string; handler: GatewayMessageHandler }): Promise<void> {
        this._handler = handler;

        return new Promise(resolve => {
            this._socket = new WebSocket(gateway_url);
            this._socket.binaryType = "arraybuffer";

            this._socket.onopen = (event: Event) => {
                this._onSocketOpened(event);
                resolve();
            };

            this._socket.onclose = (close_event: CloseEvent) => this._onSocketClosed(close_event);

            this._socket.onerror = () => {
                throw new Error("Gateway socket error");
            };

            // Temporary onmessage that handles only authentication response message.
            // When the socket is opened we send a message to authenticate the client,
            // then the renderer sends us back the confirmation (or an error).
            // This callback handles only this authentication response message.
            // As soon as the authentication is validated, we switch to the regular
            // multiplexed message handler callback.
            this._socket.onmessage = (message: MessageEvent<ArrayBuffer>) => this._onAuthenticated(message);
        });
    }

    /**
     *
     */
    send({ data }: { data: ArrayBufferLike | string }): void {
        this._socket?.send(data);
    }

    /**
     *
     */
    disconnect() {
        this._socket?.close(1000);
    }

    /**
     *
     */
    private _onSocketOpened(_event: Event) {
        console.debug("Connected to the 3dverse rendering gateway:", this._socket!.url);
    }

    /**
     *
     */
    private _onSocketClosed(closeEvent: CloseEvent) {
        if (closeEvent.wasClean === false) {
            console.error("Gateway socket forcibly closed", closeEvent);
        } else {
            console.debug("Disconnected from the 3dverse rendering gateway");
        }
    }

    /**
     *
     */
    private _onAuthenticated(message: MessageEvent<ArrayBuffer>) {
        this._handler!._on_authenticateClient_response({
            dataView: new DataView(message.data),
        });

        // Switch the onmessage callback to the regular multiplexed one.
        this._socket!.onmessage = (message: MessageEvent<ArrayBuffer>) => this._onMessageReceived({ message });
    }

    /**
     *
     */
    private _onMessageReceived({ message }: { message: MessageEvent<ArrayBuffer> }): void {
        // First byte is the channel id.
        // 3 following bytes are the message total size EXCLUDING the first 4 bytes.
        const channelId = new DataView(message.data).getUint8(0) as ChannelId;
        const dataView = new DataView(message.data, FTL_HEADER_SIZE);
        const handler = this._handler!;

        switch (channelId) {
            case ChannelId.registration:
                handler._on_configureClient_response({ dataView });
                break;

            case ChannelId.video_stream:
                handler._onFrameReceived({ dataView });
                break;

            case ChannelId.viewer_control:
                handler._on_resize_response({ dataView });
                break;

            case ChannelId.client_remote_operations:
                this._clientRemoteOperation_response({ dataView });
                break;

            case ChannelId.heartbeat:
                handler._on_pulseHeartbeat_response();
                break;

            case ChannelId.broadcast_script_events:
                handler._onScriptEventReceived({ dataView });
                break;

            case ChannelId.audio_stream:
            case ChannelId.asset_loading_events:
            case ChannelId.gpu_memory_profiler:
                break;

            default:
                throw new Error(`Received message on an unsupported channel '${ChannelId[channelId]}' (${channelId})`);
        }
    }

    /**
     * Rendering server response.
     */
    private _clientRemoteOperation_response({ dataView }: { dataView: DataView }) {
        let offset = 0;
        const client_id = deserialize_UUID({ dataView, offset });
        offset += UUID_BYTE_SIZE;
        const request_id = dataView.getUint32(offset, LITTLE_ENDIAN);
        offset += 4;
        const size = dataView.getUint32(offset, LITTLE_ENDIAN);
        offset += 4;

        this._handler!._on_clientRemoteOperation_response({
            client_id,
            request_id,
            size,
            dataView: new DataView(dataView.buffer, dataView.byteOffset + offset),
        });
    }
}

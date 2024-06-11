/**
 * DO NOT EDIT THIS FILE MANUALLY.
 * This file has been generated automatically from its AsyncAPI spec file.
 * See : https://gitlab.com/3dverse/platform/libs/js/asyncapi-server-generator
 */

import {
    FTL_CLIENT_ROP_HEADER_SIZE,
    FTL_EDITOR_ROP_HEADER_SIZE,
    FTL_HEADER_SIZE,
    LITTLE_ENDIAN,
} from "../sources/types/constants";
import {
    ChannelId,
    ClientConfig,
    ClientRemoteOperation,
    ViewerControlOperation,
    ViewportConfig,
    serialize_ViewportConfig,
    SessionAuth,
    AuthenticationResponse,
    deserialize_AuthenticationResponse,
    ClientConfigResponse,
    deserialize_ClientConfigResponse,
    ResizeResponse,
    deserialize_ResizeResponse,
    ScreenSpaceRayResult,
    deserialize_ScreenSpaceRayResult,
    deserialize_FrameData,
    ScreenSpaceRayQuery,
    serialize_ScreenSpaceRayQuery,
    InputState,
    serialize_HighlightEntitiesMessage,
    HighlightEntitiesMessage,
    EditorRemoteOperation,
    serialize_UpdateEntitiesFromJsonMessage,
    UpdateEntitiesFromJsonMessage,
    compute_UpdateEntitiesFromJsonMessage_size,
    deserialize_ScriptEvent,
    FireEventMessage,
    compute_FireEventMessage_size,
    serialize_FireEventMessage,
    UpdateAnimationSequenceStateMessage,
    serialize_UpdateAnimationSequenceStateMessage,
    AssignClientToScriptMessage,
    serialize_assignClientToScriptMessage,
} from "./types";
import { MessageHandler } from "../sources/MessageHandler";
import { GatewayConnection } from "./GatewayConnection";
import { UUID, Vec2ui16, serialize_UUID, serialize_Vec2ui16 } from "../sources/types";

/**
 *
 */
type ResolverPayload = {
    rop_id: ClientRemoteOperation | EditorRemoteOperation;
    request_id: number;
};

/**
 * Message handlers interface.
 * This follows the Livelink protocol specifications for the gateway messages.
 */
export class GatewayMessageHandler extends MessageHandler<ChannelId, ResolverPayload> {
    /**
     *
     */
    protected readonly _connection = new GatewayConnection();

    /**
     *
     */
    private _request_id_generator = 1;

    /**
     *
     */
    private _client_id: UUID | null = null;

    /**
     * Request
     */
    authenticateClient({ session_auth }: { session_auth: SessionAuth }): Promise<AuthenticationResponse> {
        const payload = JSON.stringify({
            // Translate to legacy names
            sessionKey: session_auth.session_key,
            clientApp: session_auth.client_app,
            os: session_auth.os,
        });

        const buffer = new ArrayBuffer(2);
        new DataView(buffer).setUint16(0, payload.length, LITTLE_ENDIAN);

        this._connection.send({ data: buffer });
        this._connection.send({ data: payload });

        return this._makeMessageResolver<AuthenticationResponse>({
            channel_id: ChannelId.authentication,
        });
    }

    /**
     * Reply
     */
    _on_authenticateClient_response({ dataView }: { dataView: DataView }): void {
        const authRes = deserialize_AuthenticationResponse({ dataView, offset: 0 });
        this._client_id = authRes.client_id;
        this._getNextMessageResolver({
            channel_id: ChannelId.authentication,
        }).resolve(authRes);
    }

    /**
     * Request
     */
    pulseHeartbeat(): Promise<void> {
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE);
        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.heartbeat,
            size: 0,
        });
        this._connection.send({ data: buffer });

        return this._makeMessageResolver<void>({ channel_id: ChannelId.heartbeat });
    }

    /**
     * Reply
     */
    _on_pulseHeartbeat_response(): void {
        this._getNextMessageResolver({ channel_id: ChannelId.heartbeat }).resolve();
    }

    /**
     * Request
     */
    configureClient({ client_config }: { client_config: ClientConfig }): Promise<ClientConfigResponse> {
        const payload = JSON.stringify({
            // Translate to legacy names
            renderingAreaSize: client_config.remote_canvas_size,
            encoderConfig: client_config.encoder_config,
            inputConfig: {
                hasKeyboard: client_config.supported_devices.keyboard,
                hasMouse: client_config.supported_devices.mouse,
                hasHololens: client_config.supported_devices.hololens,
                hasGamepad: client_config.supported_devices.gamepad,
                hasTouchscreen: client_config.supported_devices.touchscreen,
            },
        });

        const buffer = new ArrayBuffer(FTL_HEADER_SIZE);
        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.registration,
            size: payload.length,
        });

        this._connection.send({ data: buffer });
        this._connection.send({ data: payload });

        return this._makeMessageResolver<ClientConfigResponse>({
            channel_id: ChannelId.registration,
        });
    }

    /**
     * Reply
     */
    _on_configureClient_response({ dataView }: { dataView: DataView }): void {
        this._getNextMessageResolver({
            channel_id: ChannelId.registration,
        }).resolve(deserialize_ClientConfigResponse({ dataView, offset: 0 }));
    }

    /**
     * Send
     */
    setViewports({ viewports }: { viewports: Array<ViewportConfig> }): void {
        const SIZE_OF_VIEWPORT_CONFIG = 20;
        const payloadSize = 2 + viewports.length * SIZE_OF_VIEWPORT_CONFIG;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);
        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.viewer_control,
            size: payloadSize,
        });

        const writer = new DataView(buffer, FTL_HEADER_SIZE);
        let offset = 0;
        writer.setUint8(offset, ViewerControlOperation.set_viewports);
        offset += 1;

        writer.setUint8(offset, viewports.length);
        offset += 1;

        for (const viewportConfig of viewports) {
            offset += serialize_ViewportConfig({
                dataView: writer,
                offset,
                viewportConfig,
            });
        }

        this._connection.send({ data: buffer });
    }

    /**
     * Send
     */
    resume(): void {
        const payloadSize = 1;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);
        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.viewer_control,
            size: payloadSize,
        });

        const writer = new DataView(buffer, FTL_HEADER_SIZE);
        let offset = 0;
        writer.setUint8(offset, ViewerControlOperation.resume);
        offset += 1;

        this._connection.send({ data: buffer });
    }

    /**
     * Send
     */
    suspend(): void {
        const payloadSize = 1;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);
        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.viewer_control,
            size: payloadSize,
        });

        const writer = new DataView(buffer, FTL_HEADER_SIZE);
        let offset = 0;
        writer.setUint8(offset, ViewerControlOperation.suspend);
        offset += 1;

        this._connection.send({ data: buffer });
    }

    /**
     * Request
     */
    resize({ size }: { size: Vec2ui16 }): Promise<ResizeResponse> {
        const payloadSize = 1 + 4;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);
        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.viewer_control,
            size: payloadSize,
        });

        const writer = new DataView(buffer, FTL_HEADER_SIZE);
        let offset = 0;
        writer.setUint8(offset, ViewerControlOperation.resize);
        offset += 1;
        offset += serialize_Vec2ui16({ dataView: writer, offset, v: size });

        this._connection.send({ data: buffer });

        return this._makeMessageResolver<ResizeResponse>({
            channel_id: ChannelId.viewer_control,
        });
    }

    /**
     * Reply
     */
    _on_resize_response({ dataView }: { dataView: DataView }): void {
        this._getNextMessageResolver({
            channel_id: ChannelId.viewer_control,
        }).resolve(deserialize_ResizeResponse({ dataView, offset: 0 }));
    }

    /**
     * Send
     */
    sendInputState({ input_state }: { input_state: InputState }): void {
        const INPUT_HEADER_SIZE = 1;
        const inputDataSize = input_state.input_data.length || 0;

        const payloadSize = INPUT_HEADER_SIZE + inputDataSize;

        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.inputs,
            size: payloadSize,
        });

        const writer = new DataView(buffer, FTL_HEADER_SIZE);
        let offset = 0;
        writer.setUint8(offset, input_state.input_operation);
        offset += 1;

        for (var a = 0; a < inputDataSize; a++) {
            writer.setUint8(offset++, input_state.input_data[a]);
        }

        this._connection.send({ data: buffer });
    }

    /**
     * Receive
     */
    _onFrameReceived({ dataView }: { dataView: DataView }): void {
        const frame_data = deserialize_FrameData({
            dataView,
            offset: 0,
        });

        this.dispatchEvent(new CustomEvent("on-frame-received", { detail: frame_data }));
    }

    /**
     * Receive
     */
    _onScriptEventReceived({ dataView }: { dataView: DataView }): void {
        const script_event = deserialize_ScriptEvent({ dataView, offset: 0 });

        this.dispatchEvent(new CustomEvent("on-script-event-received", { detail: script_event }));
    }

    /**
     * Request
     */
    castScreenSpaceRay({
        screenSpaceRayQuery,
    }: {
        screenSpaceRayQuery: ScreenSpaceRayQuery;
    }): Promise<ScreenSpaceRayResult> {
        const ropDataSize = 4 + 4 + 4 + 1;
        const payloadSize = FTL_CLIENT_ROP_HEADER_SIZE + ropDataSize;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.client_remote_operations,
            size: payloadSize,
        });

        const rop_id = ClientRemoteOperation.cast_screen_space_ray;
        const request_id = this._writeRemoteOperationMultiplexerHeader({
            buffer,
            offset: FTL_HEADER_SIZE,
            rop_data_size: ropDataSize,
            rop_id,
        });

        const dataView = new DataView(buffer, FTL_HEADER_SIZE + FTL_CLIENT_ROP_HEADER_SIZE);
        serialize_ScreenSpaceRayQuery({ dataView, offset: 0, screenSpaceRayQuery });

        this._connection.send({ data: buffer });

        return this._makeMessageResolver<ScreenSpaceRayResult>({
            channel_id: ChannelId.client_remote_operations,
            payload: { rop_id, request_id },
        });
    }

    /**
     * Send
     */
    highlightEntities({ highlightEntitiesMessage }: { highlightEntitiesMessage: HighlightEntitiesMessage }): void {
        const ropDataSize = 1 + highlightEntitiesMessage.entities.length * 4;
        const payloadSize = FTL_CLIENT_ROP_HEADER_SIZE + ropDataSize;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.client_remote_operations,
            size: payloadSize,
        });

        this._writeRemoteOperationMultiplexerHeader({
            buffer,
            offset: FTL_HEADER_SIZE,
            rop_data_size: ropDataSize,
            rop_id: ClientRemoteOperation.select_entities,
        });

        const dataView = new DataView(buffer, FTL_HEADER_SIZE + FTL_CLIENT_ROP_HEADER_SIZE);
        serialize_HighlightEntitiesMessage({
            dataView,
            offset: 0,
            highlightEntitiesMessage,
        });

        this._connection.send({ data: buffer });
    }

    /**
     * Send
     */
    fireEvent({ fireEventMessage }: { fireEventMessage: FireEventMessage }): void {
        const ropDataSize = compute_FireEventMessage_size(fireEventMessage);
        const payloadSize = FTL_EDITOR_ROP_HEADER_SIZE + ropDataSize;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.editor_remote_operations,
            size: payloadSize,
        });

        this._writeRemoteOperationMultiplexerHeader({
            buffer,
            offset: FTL_HEADER_SIZE,
            rop_data_size: ropDataSize,
            rop_id: EditorRemoteOperation.fire_event,
        });

        const dataView = new DataView(buffer, FTL_HEADER_SIZE + FTL_EDITOR_ROP_HEADER_SIZE);

        serialize_FireEventMessage({
            dataView,
            offset: 0,
            fireEventMessage,
        });

        this._connection.send({ data: buffer });
    }

    /**
     * Send
     */
    updateAnimationSequenceState({
        updateAnimationSequenceStateMessage,
    }: {
        updateAnimationSequenceStateMessage: UpdateAnimationSequenceStateMessage;
    }): void {
        const ropDataSize = 4 + 16 + 4 + 4 + 0;
        const payloadSize = FTL_EDITOR_ROP_HEADER_SIZE + ropDataSize;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.editor_remote_operations,
            size: payloadSize,
        });

        this._writeRemoteOperationMultiplexerHeader({
            buffer,
            offset: FTL_HEADER_SIZE,
            rop_data_size: ropDataSize,
            rop_id: EditorRemoteOperation.update_animation_sequence_state,
        });

        const dataView = new DataView(buffer, FTL_HEADER_SIZE + FTL_EDITOR_ROP_HEADER_SIZE);

        serialize_UpdateAnimationSequenceStateMessage({
            dataView,
            offset: 0,
            updateAnimationSequenceStateMessage,
        });

        this._connection.send({ data: buffer });
    }

    /**
     * Send
     */
    assignClientToScript({
        assignClientToScriptMessage,
    }: {
        assignClientToScriptMessage: AssignClientToScriptMessage;
    }): void {
        const ropDataSize = 16 + 16 + 4;
        const payloadSize = FTL_EDITOR_ROP_HEADER_SIZE + ropDataSize;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.editor_remote_operations,
            size: payloadSize,
        });

        this._writeRemoteOperationMultiplexerHeader({
            buffer,
            offset: FTL_HEADER_SIZE,
            rop_data_size: ropDataSize,
            rop_id: EditorRemoteOperation.assign_client_uuid_to_script,
        });

        const dataView = new DataView(buffer, FTL_HEADER_SIZE + FTL_EDITOR_ROP_HEADER_SIZE);

        serialize_assignClientToScriptMessage({
            dataView,
            offset: 0,
            assignClientToScriptMessage,
        });

        this._connection.send({ data: buffer });
    }

    /**
     * Send
     */
    updateEntities({
        updateEntitiesFromJsonMessage,
    }: {
        updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage;
    }): void {
        const ropDataSize = compute_UpdateEntitiesFromJsonMessage_size(updateEntitiesFromJsonMessage);
        const payloadSize = FTL_EDITOR_ROP_HEADER_SIZE + ropDataSize;
        const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);

        this._writeMultiplexerHeader({
            buffer,
            channelId: ChannelId.editor_remote_operations,
            size: payloadSize,
        });

        this._writeRemoteOperationMultiplexerHeader({
            buffer,
            offset: FTL_HEADER_SIZE,
            rop_data_size: ropDataSize,
            rop_id: EditorRemoteOperation.update_entities_from_json,
        });

        const dataView = new DataView(buffer, FTL_HEADER_SIZE + FTL_EDITOR_ROP_HEADER_SIZE);

        serialize_UpdateEntitiesFromJsonMessage({
            dataView,
            offset: 0,
            updateEntitiesFromJsonMessage,
        });

        this._connection.send({ data: buffer });
    }

    /**
     * Reply
     */
    _on_clientRemoteOperation_response({
        client_id,
        request_id,
        size,
        dataView,
    }: {
        client_id: UUID;
        request_id: number;
        size: number;
        dataView: DataView;
    }): void {
        if (client_id !== this._client_id) {
            console.warn(
                `Received a response from client ${client_id}, whereas we are client ${this._client_id}. Something's off.`,
            );
        }

        const resolver = this._getNextMessageResolver({
            channel_id: ChannelId.client_remote_operations,
        });

        if (!resolver.payload) {
            throw new Error("Someting went wrong with the client remote operations resolver. Payload is missing.");
        }

        if (resolver.payload.request_id !== request_id) {
            throw new Error(`Expected request id ${resolver.payload.request_id}, received ${request_id}`);
        }

        if (resolver.payload.rop_id === undefined) {
            throw new Error("Resolver has and undefined ROP id");
        }

        switch (resolver.payload.rop_id) {
            case ClientRemoteOperation.cast_screen_space_ray:
                resolver.resolve(deserialize_ScreenSpaceRayResult({ dataView, offset: 0 }));
                break;

            default:
                throw new Error(
                    `Received a response for a client remote operation on an unhandled ROP channel ${
                        ClientRemoteOperation[resolver.payload.rop_id!]
                    }`,
                );
        }
    }

    /**
     *
     */
    private _writeMultiplexerHeader({
        buffer,
        channelId,
        size,
    }: {
        buffer: ArrayBuffer;
        channelId: ChannelId;
        size: number;
    }) {
        const writer = new DataView(buffer);
        writer.setUint8(0, channelId);
        writer.setUint8(1, 0xff & (size >> 0));
        writer.setUint8(2, 0xff & (size >> 8));
        writer.setUint8(3, 0xff & (size >> 16));
    }

    /**
     *
     */
    private _writeRemoteOperationMultiplexerHeader({
        buffer,
        offset,
        rop_data_size,
        rop_id,
    }: {
        buffer: ArrayBuffer;
        offset: number;
        rop_data_size: number;
        rop_id: ClientRemoteOperation | EditorRemoteOperation;
    }): number {
        const writer = new DataView(buffer);

        offset += serialize_UUID({
            dataView: writer,
            offset,
            uuid: this._client_id!,
        });

        const request_id = this._request_id_generator++;

        writer.setUint32(offset, request_id, LITTLE_ENDIAN);
        offset += 4;

        writer.setUint32(offset, rop_data_size, LITTLE_ENDIAN);
        offset += 4;

        writer.setUint8(offset, rop_id);
        offset += 1;

        return request_id;
    }
}

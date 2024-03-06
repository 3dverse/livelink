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
  Vec2ui16,
  ViewerControlOperation,
  serialize_Vec2ui16,
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
  UUID,
  serialize_UUID,
  InputState,
  serialize_HighlightEntitiesMessage,
  HighlightEntitiesMessage,
  EditorRemoteOperation,
  serialize_UpdateEntitiesFromJsonMessage,
  UpdateEntitiesFromJsonMessage,
  compute_UpdateEntitiesFromJsonMessage_size,
} from "./types";
import { GatewayConnection } from "./GatewayConnection";

/**
 *
 */
type MessageResolver = {
  resolve: (u?: any) => void;
  reject: (reason?: unknown) => void;
  rop_id?: ClientRemoteOperation;
  request_id?: number;
};

/**
 * Message handlers interface.
 * This follows the LiveLink protocol specifications for the gateway messages.
 */
export class GatewayMessageHandler extends EventTarget {
  /**
   *
   */
  protected readonly _connection = new GatewayConnection();

  /**
   *
   */
  private readonly _resolvers = new Map<ChannelId, Array<MessageResolver>>();

  /**
   *
   */
  private _request_id_generator = 1;

  /**
   *
   */
  private _client_id: UUID | null = null;

  /**
   *
   */
  private _makeMessageResolver<T>({
    channel_id,
    rop_id,
    request_id,
  }: {
    channel_id: ChannelId;
    rop_id?: ClientRemoteOperation;
    request_id?: number;
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._resolvers.set(channel_id, [
        ...(this._resolvers.get(channel_id) ?? []),
        { resolve, reject, rop_id, request_id },
      ]);
    });
  }

  /**
   *
   */
  private _getNextMessageResolver({
    channel_id,
  }: {
    channel_id: ChannelId;
  }): MessageResolver {
    const handlers = this._resolvers.get(channel_id);
    if (!handlers || handlers.length === 0) {
      throw new Error(
        `No handler for message on channel ${ChannelId[channel_id]}`
      );
    }

    return handlers.shift()!;
  }

  /**
   * Request
   */
  authenticateClient({
    session_auth,
  }: {
    session_auth: SessionAuth;
  }): Promise<AuthenticationResponse> {
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
  _on_authenticateClient_response({ dataView }: { dataView: DataView }) {
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
  configureClient({
    client_config,
  }: {
    client_config: ClientConfig;
  }): Promise<ClientConfigResponse> {
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
  setViewports({ viewports }: { viewports: Array<ViewportConfig> }) {
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
  resume() {
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
  suspend() {
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
  resize({ size }: { size: Vec2ui16 }) {
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
  _on_resize_response({ dataView }: { dataView: DataView }) {
    this._getNextMessageResolver({
      channel_id: ChannelId.viewer_control,
    }).resolve(deserialize_ResizeResponse({ dataView, offset: 0 }));
  }

  /**
   * Send
   */
  sendInputState({ input_state }: { input_state: InputState }) {
    const payloadSize = 1;
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

    this._connection.send({ data: buffer });
  }

  /**
   * Receive
   */
  _onFrameReceived({ dataView }: { dataView: DataView }) {
    const frame_data = deserialize_FrameData({
      dataView,
      offset: 0,
    });

    this.dispatchEvent(
      new CustomEvent("on-frame-received", { detail: frame_data })
    );
  }

  /**
   * Request
   */
  castScreenSpaceRay({
    screenSpaceRayQuery,
  }: {
    screenSpaceRayQuery: ScreenSpaceRayQuery;
  }) {
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

    const dataView = new DataView(
      buffer,
      FTL_HEADER_SIZE + FTL_CLIENT_ROP_HEADER_SIZE
    );
    serialize_ScreenSpaceRayQuery({ dataView, offset: 0, screenSpaceRayQuery });

    this._connection.send({ data: buffer });

    return this._makeMessageResolver<ScreenSpaceRayResult>({
      channel_id: ChannelId.client_remote_operations,
      rop_id,
      request_id,
    });
  }

  /**
   * Send
   */
  highlightEntities({
    highlightEntitiesMessage,
  }: {
    highlightEntitiesMessage: HighlightEntitiesMessage;
  }): void {
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

    const dataView = new DataView(
      buffer,
      FTL_HEADER_SIZE + FTL_CLIENT_ROP_HEADER_SIZE
    );
    serialize_HighlightEntitiesMessage({
      dataView,
      offset: 0,
      highlightEntitiesMessage,
    });

    this._connection.send({ data: buffer });
  }

  /**
   *
   */
  updateEntities({
    updateEntitiesFromJsonMessage,
  }: {
    updateEntitiesFromJsonMessage: UpdateEntitiesFromJsonMessage;
  }) {
    const ropDataSize = compute_UpdateEntitiesFromJsonMessage_size(
      updateEntitiesFromJsonMessage
    );
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

    const dataView = new DataView(
      buffer,
      FTL_HEADER_SIZE + FTL_EDITOR_ROP_HEADER_SIZE
    );

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
  }) {
    if (client_id !== this._client_id) {
      console.warn(
        `Received a response from client ${client_id}, whereas we are client ${this._client_id}. Something's off.`
      );
    }

    const resolver = this._getNextMessageResolver({
      channel_id: ChannelId.client_remote_operations,
    })!;

    if (resolver.request_id !== request_id) {
      throw new Error(
        `Expected request id ${resolver.request_id}, received ${request_id}`
      );
    }

    if (resolver.rop_id === undefined) {
      throw new Error("Resolver has and undefined ROP id");
    }

    switch (resolver.rop_id) {
      case ClientRemoteOperation.cast_screen_space_ray:
        resolver.resolve(
          deserialize_ScreenSpaceRayResult({ dataView, offset: 0 })
        );
        break;

      default:
        throw new Error(
          `Received a response for a client remote operation on an unhandled ROP channel ${
            ClientRemoteOperation[resolver.rop_id!]
          }`
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

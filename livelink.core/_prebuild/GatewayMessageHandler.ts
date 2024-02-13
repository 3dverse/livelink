import {
  AuthenticationStatus,
  CodecType,
  FrameMetaData,
  RTID,
  UUID,
  Vec2i,
  Vec3,
} from "./types";

/**
 * Response handlers interface
 */
export interface GatewayMessageHandler {
  /**
   *
   */
  on_authenticateClient_response({
    status,
    client_id,
  }: {
    status: AuthenticationStatus;
    client_id: UUID;
  }): void;

  /**
   *
   */
  on_configureClient_response({ codec }: { codec: CodecType }): void;

  /**
   *
   */
  on_pulseHeartbeat_response(): void;

  /**
   *
   */
  on_resize_response({ size }: { size: Vec2i }): void;

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
  }): void;

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
  }): void;
}

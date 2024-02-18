import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";

/**
 *
 */
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec2i = Vec2;
export type Vec2ui16 = Vec2;
export type Mat4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

/**
 *
 */
export function deserialize_Vec2ui16({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Vec2ui16 {
  return [
    dataView.getUint16(offset + 0, LITTLE_ENDIAN),
    dataView.getUint16(offset + 2, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export function serialize_Vec2ui16({
  dataView,
  offset,
  v,
}: {
  dataView: DataView;
  offset: number;
  v: Vec2ui16;
}): number {
  dataView.setUint16(offset + 0, v[0], LITTLE_ENDIAN);
  dataView.setUint16(offset + 2, v[1], LITTLE_ENDIAN);
  return 2 * 2;
}

/**
 *
 */
export function serialize_Vec2({
  dataView,
  offset,
  v,
}: {
  dataView: DataView;
  offset: number;
  v: Vec2;
}): number {
  dataView.setFloat32(offset + 0, v[0], LITTLE_ENDIAN);
  dataView.setFloat32(offset + 4, v[1], LITTLE_ENDIAN);
  return 2 * 4;
}

/**
 *
 */
export function deserialize_Vec3({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Vec3 {
  return [
    dataView.getFloat32(offset + 0, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 4, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 8, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export function deserialize_Vec2i({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Vec2i {
  return [
    dataView.getInt32(offset + 0, LITTLE_ENDIAN),
    dataView.getInt32(offset + 4, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export function deserialize_Mat4({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): Mat4 {
  return [
    dataView.getFloat32(offset + 0, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 4, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 8, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 12, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 16, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 20, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 24, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 28, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 32, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 36, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 40, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 44, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 48, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 52, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 56, LITTLE_ENDIAN),
    dataView.getFloat32(offset + 60, LITTLE_ENDIAN),
  ];
}

/**
 *
 */
export type RTID = bigint;
/**
 *
 */
export function serialize_RTID({
  dataView,
  offset,
  rtid,
}: {
  dataView: DataView;
  offset: number;
  rtid: RTID;
}): number {
  //TODO: change me when we support 64bits RTIDs
  dataView.setUint32(offset, Number(rtid), LITTLE_ENDIAN);
  return 4;
}
/**
 *
 */
export function deserialize_RTID({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): RTID {
  return BigInt(dataView.getUint32(offset, LITTLE_ENDIAN));
}

/**
 *
 */
export type UUID = string;
/**
 *
 */
export function serialize_UUID({
  dataView,
  offset,
  uuid,
}: {
  dataView: DataView;
  offset: number;
  uuid: UUID;
}): number {
  //dataView.setUint32(offset, Number(rtid), LITTLE_ENDIAN);
  return 16;
}

/**
 *
 */
const byteToHex: string[] = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}
export function deserialize_UUID({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): UUID {
  const arr = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, 16);

  dataView.setUint32(
    offset + 0,
    dataView.getUint32(offset + 0, LITTLE_ENDIAN),
    BIG_ENDIAN
  );
  dataView.setUint16(
    offset + 4,
    dataView.getUint16(offset + 4, LITTLE_ENDIAN),
    BIG_ENDIAN
  );
  dataView.setUint16(
    offset + 6,
    dataView.getUint16(offset + 6, LITTLE_ENDIAN),
    BIG_ENDIAN
  );

  return (
    byteToHex[arr[0]] +
    byteToHex[arr[1]] +
    byteToHex[arr[2]] +
    byteToHex[arr[3]] +
    "-" +
    byteToHex[arr[4]] +
    byteToHex[arr[5]] +
    "-" +
    byteToHex[arr[6]] +
    byteToHex[arr[7]] +
    "-" +
    byteToHex[arr[8]] +
    byteToHex[arr[9]] +
    "-" +
    byteToHex[arr[10]] +
    byteToHex[arr[11]] +
    byteToHex[arr[12]] +
    byteToHex[arr[13]] +
    byteToHex[arr[14]] +
    byteToHex[arr[15]]
  );
}

/**
 *
 */
export enum ChannelId {
  registration = 1,
  video_stream = 2,
  inputs = 3,
  viewer_control = 4,
  client_remote_operations = 5,
  editor_remote_operations = 6,
  /**
   * @deprecated
   */
  DEPRECATED__camera_sharing = 7,
  broadcast_clients = 8,
  broadcast_video_stream = 9,
  /**
   * @deprecated
   */
  DEPRECATED__spatial_anchor = 10,
  heartbeat = 11,
  video_stream_header = 12,
  audio_stream = 13,
  broadcast_script_events = 14,
  asset_loading_events = 15,
  gpu_memory_profiler = 16,
}

/**
 *
 */
export enum ClientRemoteOperation {
  asset_loading_status = 0,
  /**
   * @deprecated
   */
  DEPRECATED__update_ar_cameras = 1,
  create_controller = 2,
  cast_screen_space_ray = 3,
  select_entities = 4,
  set_controllers_state = 5,
  delete_controller = 6,
  update_action_map = 7,
  update_selection_color = 8,
  update_camera_controller_settings = 9,
  physics_raycast = 10,
}

export enum ViewportControlOperation {
  resize = 0,
  DEPRECATED_update_action_map = 1,
  suspend = 2,
  resume = 3,
  encoder_params = 4,
  set_viewports = 5,
}

/**
 *
 */
export enum CodecType {
  h264 = 0,
  h264rgb = 1,
  h265 = 2,
}

/**
 *
 */
export enum EncodingProfile {
  base = 0,
  main = 1,
  high = 2,
}

/**
 *
 */
export type EncoderConfig = {
  codec: CodecType;
  profile: EncodingProfile;
  frame_rate: number;
  lossy: boolean;
};

/**
 *
 */
export type ClientConfig = {
  rendering_area_size: Vec2i;
  encoder_config: EncoderConfig;
  supported_devices: SupportedDevices;
  canvas_context: CanvasRenderingContext2D;
};

/**
 *
 */
export type SupportedDevices = {
  keyboard: boolean;
  mouse: boolean;
  hololens: boolean;
  gamepad: boolean;
  touchscreen: boolean;
};

/**
 *
 */
export enum HighlightMode {
  None = 0,
  HighlightAndKeepOldSelection = 1,
  HighlightAndDiscardOldSelection = 2,
}

export type SessionAuth = {
  session_key: string;
  client_app: string;
  os: string;
};

/**
 *
 */
export enum AuthenticationStatus {
  // Common
  unknown_error = 0,
  success = 1,
  // Join session errors
  authentication_failed = 100,
  session_not_found,
  session_closed,
  // Launcher errors
  launcher_not_found = 200,
  unknown_service,
  service_boot_error,
  // Session creation errors
  invalid_request = 300,
  duplicate_session,
  // Client errors
  client_not_found = 400,
}

type ViewportMetaData = {
  camera_rtid: RTID;
  ws_from_ls: Mat4;
};

type ClientMetaData = {
  client_id: UUID;
  viewports: Array<ViewportMetaData>;
};

export type FrameMetaData = {
  renderer_timestamp: number;
  frame_counter: number;
  clients: Array<ClientMetaData>;
};

export function deserialize_FrameMetaData({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): FrameMetaData {
  const frameMetaData: FrameMetaData = {
    renderer_timestamp: dataView.getUint32(offset, LITTLE_ENDIAN),
    frame_counter: dataView.getUint32(offset + 4, LITTLE_ENDIAN),
    clients: [],
  };
  offset += 8;

  const client_count = dataView.getUint8(offset);
  offset += 1;

  for (let i = 0; i < client_count; ++i) {
    frameMetaData.clients.push({
      client_id: deserialize_UUID({ dataView, offset }),
      viewports: [],
    });
    offset += 16;

    const viewport_count = dataView.getUint8(offset);
    offset += 1;

    for (let j = 0; j < viewport_count; ++j) {
      frameMetaData.clients[i].viewports.push({
        camera_rtid: BigInt(dataView.getUint32(offset, LITTLE_ENDIAN)),
        ws_from_ls: deserialize_Mat4({ dataView, offset: offset + 4 }),
      });
      offset += 4 + 16 * 4;
    }
  }

  return frameMetaData;
}

export type ConnectConfirmation = {
  folder_id: UUID;
  scene_id: UUID;
  user_id: UUID;
  session_id: UUID;
  //components: Record<ComponentName, ComponentDescription>;
  //settings: SettingsMap;
  //settingDescriptions: Record<SettingName, SettingDescription>;
  //sceneSettings: SettingsMap;
  //clientRTID: string;
  //canEdit: boolean;
  //clientColors: Record<string, string>;
  //selectColor: string;
  //stats: Stats;
  //undoRedo: unknown;
  //rootNodes: EditorEntity[];
  //animationSequenceInstances: AnimationSequence[];
};

export type Component = {};
export type Components = Map<string, Component>;

export type ClientInfo = {
  client_id: UUID;
  client_type: "user" | "guest";
  user_id: UUID;
  username: string;
};

export type SessionInfo = {
  session_id: UUID;
  scene_id: UUID;
  scene_name: string;
  folder_id: UUID;
  max_users: number;
  creator_user_id: UUID;
  created_at: Date;
  country_code: string;
  continent_code: string;
  clients: Array<ClientInfo>;
};

export type ViewportConfig = {
  left: number;
  top: number;
  width: number;
  height: number;
  camera_rtid: number;
};

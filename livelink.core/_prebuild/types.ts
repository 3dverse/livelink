import { LITTLE_ENDIAN } from "./constants";

/**
 *
 */
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Vec2i = Vec2;
export type Vec3i = Vec3;
export type Vec4i = Vec4;
export type Quat = [number, number, number, number];
export type Mat4x4 = [
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
export type RTID = bigint;

/**
 *
 */
export type UUID = string;

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
  ws_from_ls: Mat4x4;
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
  const meta_data: FrameMetaData = {
    renderer_timestamp: dataView.getUint32(offset, LITTLE_ENDIAN),
    frame_counter: dataView.getUint32(offset + 4, LITTLE_ENDIAN),
    clients: [],
  };
  offset += 8;

  const client_count = dataView.getUint8(offset);
  offset += 1;

  for (let i = 0; i < client_count; ++i) {
    meta_data.clients.push({
      client_id: "", // deserialize_uuid(dataView, offset)
      viewports: [],
    });
    offset += 16;

    const viewport_count = dataView.getUint8(offset);
    offset += 1;

    for (let j = 0; j < viewport_count; ++j) {
      meta_data.clients[i].viewports.push({
        camera_rtid: dataView.getBigUint64(offset, LITTLE_ENDIAN),
        ws_from_ls: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // deserialize_mat4(dataView, offset)
      });
      offset += 8 + 16 * 4;
    }
  }

  return meta_data;
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

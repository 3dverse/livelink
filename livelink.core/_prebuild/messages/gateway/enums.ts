/**
 *
 */
export enum ChannelId {
    authentication = 0,
    registration = 1,
    video_stream = 2,
    inputs = 3,
    viewer_control = 4,
    client_remote_operations = 5,
    editor_remote_operations = 6,
    DEPRECATED__camera_sharing = 7,
    broadcast_clients = 8,
    broadcast_video_stream = 9,
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

/**
 *
 */
export enum ViewerControlOperation {
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
export enum InputOperation {
    reset = 0,
    lbutton_down,
    mbutton_down,
    rbutton_down,
    lbutton_up,
    mbutton_up,
    rbutton_up,
    mouse_move,
    on_key_down,
    on_key_up,
    resize,
    disconnect,
    touch_start,
    touch_end,
    touch_move,
    touch_pinch_start,
    touch_pinch_move,
    window_resized,
    send_camera,
    input_resolution,
    cam_matrix,
    projection_matrix,
    wheel,
    hololens_tap,
    scene_info,
    scene_uuid,
    gamepad_axis,
    gamepad_buttons,
    mouse_move_delta,
    touch_pinch_end,
    headset_move,
}

export enum EditorRemoteOperation {
    update_config = 0,
    create_entity = 1,
    reparent_entity = 2,
    update_entities_from_bytes = 3,
    remove_components = 4,
    delete_entities = 5,

    set_visibility = 6,

    update_material = 7,
    update_volume_material = 8,
    DEPRECATED__update_data_object = 9,
    reload_asset = 10,
    fire_event = 11,
    update_script_data_object = 12,
    DEPRECATED__update_render_graph_data_object = 13,
    reload_shaders = 14,
    update_entities_from_json = 15,

    set_filter = 16,
    remove_filter = 17,
    toggle_filter = 18,

    DEPRECATED__update_animation_controller_data_object = 19,
    assign_client_uuid_to_script = 20,

    update_animation_sequence_instance = 21,
    remove_animation_sequence_instance = 22,
    update_animation_sequence_state = 23,
}

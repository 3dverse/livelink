import { ConnectConfirmation } from "./types";

export interface LiveLinkMessageHandler {
  onConnectConfirmation({
    connect_confirmation,
  }: {
    connect_confirmation: ConnectConfirmation;
  }): void;

  onRetrieveChildren(data: any): void;

  onFindEntitiesWithComponents(data: any): void;

  onResolveAncestors(data: any): void;

  onFindEntitiesByNames(data: any): void;

  onFindEntitiesByEUID(data: any): void;

  onFilterEntities(data: any): void;

  onExportEntityToScene(data: any): void;

  onNextUndoRedo(data: any): void;

  onClientColor(data: any): void;

  onSceneStatsUpdate(data: any): void;

  onServerError(data: any): void;

  // Entity creation event from another user.
  on_create_entity(data: any): void;
  on_create_entities(data: any): void;
  on_restore_entities(data: any): void;
  on_spawn_entity(data: any): void;

  // Create entity request response
  on_entities_created(data: any): void;
  on_entity_reparented(data: any): void;
  on_entities_deleted(data: any): void;
  on_animation_sequence_instance_added(data: any): void;
  on_animation_sequence_instance_updated(data: any): void;
  on_animation_sequence_instance_removed(data: any): void;
  on_node_visibility_changed(data: any): void;

  on_action_error(data: any): void;

  on_attach_components(data: any): void;
  on_update_components(data: any): void;

  on_detach_components(data: any): void;

  on_delete_entities(data: any): void;

  on_delete_entities_with_rtid(data: any): void;

  on_reparent_entity(data: any): void;

  on_entities_overridden(data: any): void;

  on_update_settings(data: any): void;

  on_select_entities(data: any): void;

  on_add_animation_sequence_instance(data: any): void;

  on_update_animation_sequence_instance(data: any): void;

  on_remove_animation_sequence_instance(data: any): void;

  on_set_node_visibility(data: any): void;

  onUnhandledMessage(type: string, data: any): void;
}

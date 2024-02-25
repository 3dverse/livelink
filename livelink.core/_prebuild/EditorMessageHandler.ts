import { ConnectConfirmation } from "./types/ConnectConfirmation";
import { EditorConnection } from "./EditorConnection";
import { Entity, UUID } from "../sources";

/**
 * This follows the LiveLink protocol specifications for the broker messages.
 */
export abstract class EditorMessageHandler {
  /**
   *
   */
  protected _connection = new EditorConnection();

  /**
   *
   */
  spawnEntity({ entity }: { entity: Entity }) {
    this._connection!.send({
      data: JSON.stringify({ type: "spawn-entity", data: entity }),
    });
  }

  /**
   *
   */
  attachComponents() {
    this._connection!.send({
      data: JSON.stringify({ type: "attach-components", data: {} }),
    });
  }

  /**
   *
   */
  findEntitiesByEUID({ entity_uuid }: { entity_uuid: UUID }) {
    this._connection!.send({
      data: JSON.stringify({ type: "get-entities-by-euid", data: entity_uuid }),
    });
  }

  /**
   *
   */
  abstract onConnectConfirmation({
    connect_confirmation,
  }: {
    connect_confirmation: ConnectConfirmation;
  }): void;

  abstract onRetrieveChildren(data: any): void;

  abstract onFindEntitiesWithComponents(data: any): void;

  abstract onResolveAncestors(data: any): void;

  abstract onFindEntitiesByNames(data: any): void;

  abstract onFindEntitiesByEUID(data: any): void;

  abstract onFilterEntities(data: any): void;

  abstract onExportEntityToScene(data: any): void;

  abstract onNextUndoRedo(data: any): void;

  abstract onClientColor(data: any): void;

  abstract onSceneStatsUpdate(data: any): void;

  abstract onServerError(data: any): void;

  // Entity creation event from another user.
  abstract on_create_entity(data: any): void;
  abstract on_create_entities(data: any): void;
  abstract on_restore_entities(data: any): void;
  abstract on_spawn_entity(data: any): void;

  // Create entity request response
  abstract on_entities_created(data: any): void;
  abstract on_entity_reparented(data: any): void;
  abstract on_entities_deleted(data: any): void;
  abstract on_animation_sequence_instance_added(data: any): void;
  abstract on_animation_sequence_instance_updated(data: any): void;
  abstract on_animation_sequence_instance_removed(data: any): void;
  abstract on_node_visibility_changed(data: any): void;

  abstract on_action_error(data: any): void;

  abstract on_attach_components(data: any): void;
  abstract on_update_components(data: any): void;

  abstract on_detach_components(data: any): void;

  abstract on_delete_entities(data: any): void;

  abstract on_delete_entities_with_rtid(data: any): void;

  abstract on_reparent_entity(data: any): void;

  abstract on_entities_overridden(data: any): void;

  abstract on_update_settings(data: any): void;

  abstract on_select_entities(data: any): void;

  abstract on_add_animation_sequence_instance(data: any): void;

  abstract on_update_animation_sequence_instance(data: any): void;

  abstract on_remove_animation_sequence_instance(data: any): void;

  abstract on_set_node_visibility(data: any): void;

  abstract onUnhandledMessage(type: string, data: any): void;
}

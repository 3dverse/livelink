import { EditorMessageHandler } from "../../_prebuild/EditorMessageHandler";
import { ConnectConfirmation, EditorEntity, UUID } from "../../_prebuild/types";

import { Session } from "../Session.js";
import { Client } from "../Client.js";
import { Entity } from "../Entity.js";

//const livelink_base_url = "wss://livelink.3dverse.com";
const livelink_base_url = "wss://editor-backend.3dverse.dev";

/**
 *
 */
export class EditorController extends EditorMessageHandler {
  /**
   *
   */
  private _authentication_promise_callbacks: {
    resolve: () => void;
    reject: (reason?: any) => void;
  } | null = null;

  /**
   *
   */
  private _promises = new Array<{ resolve: (d?: any) => void }>();

  /**
   *
   */
  async connectToSession({
    session,
    client,
  }: {
    session: Session;
    client: Client;
  }): Promise<void> {
    if (!session.isJoinable()) {
      throw new Error("Invalid session");
    }

    return new Promise((resolve, reject) => {
      this._authentication_promise_callbacks = { resolve, reject };
      this._connection.connect({
        livelink_url: `${livelink_base_url}?sessionKey=${session.session_key}&clientUUID=${client.uuid}`,
        handler: this,
      });
    });
  }

  /**
   *
   */
  onConnectConfirmation({
    connect_confirmation,
  }: {
    connect_confirmation: ConnectConfirmation;
  }): void {
    this._authentication_promise_callbacks!.resolve();
  }

  /**
   *
   */
  disconnect() {
    this._connection.disconnect();
  }

  /**
   *
   */
  spawnEntity({ entity }: { entity: Entity }): Promise<Array<EditorEntity>> {
    return new Promise((resolve) => {
      super.spawnEntity({ entity });
      this._promises.push({ resolve });
    });
  }

  /**
   *
   */
  on_entities_created(data: Array<EditorEntity>) {
    this._promises.shift().resolve(data);
  }

  /**
   *
   */
  findEntitiesByEUID({
    entity_uuid,
  }: {
    entity_uuid: UUID;
  }): Promise<Array<EditorEntity>> {
    return new Promise((resolve) => {
      super.findEntitiesByEUID({ entity_uuid });
      this._promises.push({ resolve });
    });
  }

  /**
   *
   */
  onFindEntitiesByEUID(data: Array<EditorEntity>) {
    this._promises.shift().resolve(data);
  }

  /**
   *
   */
  onRetrieveChildren(data: any) {
    throw new Error("Method not implemented.");
  }
  onFindEntitiesWithComponents(data: any) {
    throw new Error("Method not implemented.");
  }
  onResolveAncestors(data: any) {
    throw new Error("Method not implemented.");
  }
  onFindEntitiesByNames(data: any) {
    throw new Error("Method not implemented.");
  }
  onFilterEntities(data: any) {
    throw new Error("Method not implemented.");
  }
  onExportEntityToScene(data: any) {
    throw new Error("Method not implemented.");
  }
  onNextUndoRedo(data: any) {
    throw new Error("Method not implemented.");
  }
  onClientColor(data: any) {
    throw new Error("Method not implemented.");
  }
  onSceneStatsUpdate(data: any) {}
  onServerError(data: any) {
    console.error("onServerError:", data);
  }
  onUnhandledMessage(type: string, data: any) {
    class UnhandledMessage extends Error {
      constructor(msg: string) {
        super(msg);
        super.name = UnhandledMessage.name;
      }
    }
    throw new UnhandledMessage(type);
  }

  on_create_entity(data: any) {
    throw new Error("Method not implemented.");
  }
  on_create_entities(data: any) {
    throw new Error("Method not implemented.");
  }
  on_restore_entities(data: any) {
    throw new Error("Method not implemented.");
  }
  on_spawn_entity(data: any) {
    throw new Error("Method not implemented.");
  }
  on_entity_reparented(data: any) {
    throw new Error("Method not implemented.");
  }
  on_entities_deleted(data: any) {
    throw new Error("Method not implemented.");
  }
  on_animation_sequence_instance_added(data: any) {
    throw new Error("Method not implemented.");
  }
  on_animation_sequence_instance_updated(data: any) {
    throw new Error("Method not implemented.");
  }
  on_animation_sequence_instance_removed(data: any) {
    throw new Error("Method not implemented.");
  }
  on_node_visibility_changed(data: any) {
    throw new Error("Method not implemented.");
  }
  on_action_error(data: any) {
    throw new Error("Method not implemented.");
  }
  on_attach_components(data: any) {
    throw new Error("Method not implemented.");
  }
  on_update_components(data: any) {
    throw new Error("Method not implemented.");
  }
  on_detach_components(data: any) {
    throw new Error("Method not implemented.");
  }
  on_delete_entities(data: any) {
    throw new Error("Method not implemented.");
  }
  on_delete_entities_with_rtid(data: any) {
    throw new Error("Method not implemented.");
  }
  on_reparent_entity(data: any) {
    throw new Error("Method not implemented.");
  }
  on_entities_overridden(data: any) {
    throw new Error("Method not implemented.");
  }
  on_update_settings(data: any) {
    throw new Error("Method not implemented.");
  }
  on_select_entities(data: any) {
    throw new Error("Method not implemented.");
  }
  on_add_animation_sequence_instance(data: any) {
    throw new Error("Method not implemented.");
  }
  on_update_animation_sequence_instance(data: any) {
    throw new Error("Method not implemented.");
  }
  on_remove_animation_sequence_instance(data: any) {
    throw new Error("Method not implemented.");
  }
  on_set_node_visibility(data: any) {
    throw new Error("Method not implemented.");
  }
}

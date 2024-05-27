import { ConnectConfirmation } from "./types/ConnectConfirmation";
import { EditorConnection } from "./EditorConnection";
import { UUID } from "../sources/types";
import { MessageHandler } from "../sources/MessageHandler";
import { EditorEntity, Entity, EntityUpdatedEvent, UpdateEntitiesCommand } from "../sources";

/**
 *
 */
type ResolverPayload = {};

/**
 * This follows the LiveLink protocol specifications for the broker messages.
 */
export class EditorMessageHandler extends MessageHandler<string, ResolverPayload> {
    /**
     *
     */
    protected _connection = new EditorConnection();

    /**
     *
     */
    protected _client_id: UUID | null = null;

    /**
     *
     */
    get client_id() {
        return this._client_id;
    }

    /**
     *
     */
    spawnEntity({ entity }: { entity: Entity }) {
        this._connection!.send({
            data: JSON.stringify({ type: "spawn-entity", data: entity }),
        });

        return this._makeMessageResolver<Array<EditorEntity>>({
            channel_id: "create",
        });
    }

    on_entities_created(data: Array<EditorEntity>): void {
        this._getNextMessageResolver({ channel_id: "create" }).resolve(data);
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
    updateComponents(data: UpdateEntitiesCommand) {
        this._connection!.send({
            data: JSON.stringify({ type: "update-components", data }),
        });
    }

    /**
     *
     */
    findEntitiesByEUID({ entity_uuid }: { entity_uuid: UUID }) {
        this._connection!.send({
            data: JSON.stringify({ type: "get-entities-by-euid", data: entity_uuid }),
        });

        return this._makeMessageResolver<Array<EditorEntity>>({
            channel_id: "find-by-euid",
        });
    }

    onFindEntitiesByEUID(data: Array<EditorEntity>): void {
        this._getNextMessageResolver({ channel_id: "find-by-euid" }).resolve(data);
    }

    /**
     *
     */
    onConnectConfirmation({ connect_confirmation }: { connect_confirmation: ConnectConfirmation }): void {
        this.dispatchEvent(new CustomEvent("connect-confirmation", { detail: connect_confirmation }));
    }

    onRetrieveChildren(data: any): void {
        throw new Error("Method not implemented.");
    }

    onFindEntitiesWithComponents(data: any): void {
        throw new Error("Method not implemented.");
    }

    onResolveAncestors(data: any): void {
        throw new Error("Method not implemented.");
    }

    onFindEntitiesByNames(data: any): void {
        throw new Error("Method not implemented.");
    }

    onFilterEntities(data: any): void {
        throw new Error("Method not implemented.");
    }

    onExportEntityToScene(data: any): void {
        throw new Error("Method not implemented.");
    }

    onNextUndoRedo(data: any): void {
        throw new Error("Method not implemented.");
    }

    onClientColor(data: any): void {
        throw new Error("Method not implemented.");
    }

    onSceneStatsUpdate(data: any): void {}

    onServerError(data: any): void {
        console.error("onServerError:", data);
    }

    // Entity creation event from another user.
    on_create_entity(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_create_entities(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_restore_entities(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_spawn_entity(data: any): void {
        throw new Error("Method not implemented.");
    }

    // Create entity request response
    on_entity_reparented(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_entities_deleted(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_animation_sequence_instance_added(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_animation_sequence_instance_updated(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_animation_sequence_instance_removed(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_node_visibility_changed(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_action_error(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_attach_components(data: any): void {
        throw new Error("Method not implemented.");
    }
    on_update_components(emitter_id: UUID, entitiesUpdatedEvent: Record<UUID, EntityUpdatedEvent>): void {
        if (this._client_id !== emitter_id) {
            this.dispatchEvent(
                new CustomEvent("entities-updated", {
                    detail: entitiesUpdatedEvent,
                }),
            );
        }
    }

    on_detach_components(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_delete_entities(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_delete_entities_with_rtid(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_reparent_entity(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_entities_overridden(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_update_settings(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_select_entities(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_add_animation_sequence_instance(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_update_animation_sequence_instance(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_remove_animation_sequence_instance(data: any): void {
        throw new Error("Method not implemented.");
    }

    on_set_node_visibility(data: any): void {
        throw new Error("Method not implemented.");
    }

    onUnhandledMessage(type: string, data: any): void {
        class UnhandledMessage extends Error {
            constructor(msg: string) {
                super(msg);
                super.name = UnhandledMessage.name;
            }
        }
        throw new UnhandledMessage(type);
    }
}

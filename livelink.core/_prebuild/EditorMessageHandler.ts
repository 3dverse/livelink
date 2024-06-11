import { ConnectConfirmation } from "./types/ConnectConfirmation";
import { EditorConnection } from "./EditorConnection";
import { RTID, UUID } from "../sources/types";
import { MessageHandler } from "../sources/MessageHandler";
import { EditorEntity, EntityCreationOptions, EntityUpdatedEvent, UpdateEntitiesCommand } from "./types";
import { Entity } from "../sources";

/**
 *
 */
type ResolverPayload = {};

/**
 * This follows the Livelink protocol specifications for the broker messages.
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
    spawnEntity({ entity, options }: { entity: Entity; options?: EntityCreationOptions }) {
        this._connection!.send({
            data: JSON.stringify({
                type: "spawn-entity",
                data: {
                    entity,
                    options: options
                        ? { deleteOnClientDisconnection: options.delete_on_client_disconnection }
                        : undefined,
                },
            }),
        });

        return this._makeMessageResolver<Array<EditorEntity>>({
            channel_id: "spawn",
        });
    }

    on_entities_created(data: Array<EditorEntity>): void {
        this._getNextMessageResolver({ channel_id: "spawn" }).resolve(data);
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
    findEntitiesByEUID({ entity_uuid }: { entity_uuid: UUID }): Promise<Array<EditorEntity>> {
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

    /**
     *
     */
    retrieveChildren({ entity_rtid }: { entity_rtid: RTID }) {
        this._connection!.send({
            data: JSON.stringify({ type: "retrieve-children", data: entity_rtid.toString() }),
        });
        return this._makeMessageResolver<Record<string, EditorEntity>>({
            channel_id: "retrieve-children",
        });
    }
    onRetrieveChildren(data: Record<string, EditorEntity>): void {
        this._getNextMessageResolver({ channel_id: "retrieve-children" }).resolve(data);
    }

    onFindEntitiesWithComponents(data: any): void {
        throw new Error("Method not implemented.");
    }

    /**
     *
     */
    resolveAncestors({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<EditorEntity>> {
        this._connection!.send({
            data: JSON.stringify({ type: "resolve-ancestors", data: entity_rtid.toString() }),
        });

        return this._makeMessageResolver<Array<EditorEntity>>({
            channel_id: "resolve-ancestors",
        });
    }

    onResolveAncestors(data: Array<EditorEntity>): void {
        this._getNextMessageResolver({ channel_id: "resolve-ancestors" }).resolve(data);
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

    deleteEntities({ entity_uuids }: { entity_uuids: Array<UUID> }) {
        this._connection!.send({
            data: JSON.stringify({ type: "delete-entities", data: entity_uuids }),
        });

        return this._makeMessageResolver<Array<UUID>>({
            channel_id: "delete",
        });
    }

    on_entities_deleted(data: Array<UUID>): void {
        this._getNextMessageResolver({ channel_id: "delete" }).resolve(data);
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
    on_update_components(emitter_id: UUID | null, entitiesUpdatedEvent: Record<UUID, EntityUpdatedEvent>): void {
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

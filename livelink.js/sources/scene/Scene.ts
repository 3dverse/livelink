//------------------------------------------------------------------------------
import type {
    LivelinkCore,
    RTID,
    UUID,
    ScriptDataObject,
    Components,
    ComponentName,
    EntityResponse,
    ComponentType,
    ComponentsManifest,
    ComponentsRecord,
    Events,
    SceneSettingsRecord,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import type { Livelink } from "../Livelink";
import { Entity } from "./Entity";
import { compute_rpn } from "./Filters";
import { EntityRegistry } from "./EntityRegistry";
import { ScriptEventReceived } from "./ScriptEvents";
import { EntitiesCreatedEvent, EntitiesDeletedEvent, SceneSettingsUpdatedEvent, type SceneEvents } from "./SceneEvents";
import { TypedEventTarget } from "../TypedEventTarget";
import { Client } from "../session/Client";

/**
 * Options for creating a new entity.
 *
 * @inline
 * @category Scene
 */
export type EntityCreationOptions = {
    /**
     * Whether to delete the entity when the client disconnects.
     */
    delete_on_client_disconnection?: boolean;

    /**
     * @deprecated
     * Whether to broadcast the entity automatically.
     */
    auto_broadcast?: boolean;
};

/**
 * The scene class.
 *
 * It is the main entry point to interact with the entities in the scene.
 * It is responsible for creating, finding, and deleting entities.
 *
 * This class is not meant to be instantiated directly.
 * Instead, it is created by the {@link Livelink} instance and can be accessed through the `scene`
 * property.
 *
 * @category Scene
 */
export class Scene extends TypedEventTarget<SceneEvents> {
    /**
     * @internal
     * Registry of entities discovered until now.
     */
    public readonly _entity_registry = new EntityRegistry();

    /**
     * The livelink instance.
     */
    #instance: Livelink;

    /**
     * The core instance.
     */
    #core: LivelinkCore;

    /**
     * The pending entity requests.
     * Used to avoid duplicate requests for the same entity.
     */
    #pending_entity_requests = new Map<RTID, Promise<Array<EntityResponse>>>();

    /**
     * The settings for the scene.
     */
    #settings: SceneSettingsRecord | null = null;

    /**
     * Promise that resolves when the settings are loaded.
     */
    #settings_promise: Promise<void>;

    /**
     *
     */
    #settings_promise_resolver: (() => void) | null = null;

    /**
     * @internal
     */
    constructor(instance: Livelink, core: LivelinkCore) {
        super();
        this.#instance = instance;
        this.#core = core;

        this.#settings_promise = new Promise<void>(resolve => {
            this.#settings_promise_resolver = resolve;
        });
    }

    /**
     * Create a new entity.
     *
     * @param params
     * @param params.name - The name of the entity.
     * @param params.components - The components to add to the entity with their initial values.
     * If no initial values are provided, the default values are used.
     * @param params.options - Additional options for the entity creation.
     *
     * @returns A promise that resolves to the created entity.
     *
     * @example
     * ```typescript
     * const entity = await scene.newEntity({
     *     name: "My Entity",
     *     components: {
     *         local_transform: {
     *             position: [0, 2, 0],
     *             // default values are used for scale and orientation
     *         }
     *     },
     * });
     * ```
     */
    async newEntity({
        name,
        components,
        options,
        parent = null,
    }: {
        name: string;
        components: ComponentsManifest;
        options?: EntityCreationOptions;
        parent?: Entity | null;
    }): Promise<Entity> {
        const lineage: Partial<Components.Lineage> | undefined = parent ? { parentUUID: parent.id } : undefined;
        const entity_cores = await this.#core.createEntities({
            components: [{ debug_name: { value: name }, ...components, lineage }],
            delete_on_client_disconnection: options?.delete_on_client_disconnection ?? false,
            is_transient: true,
        });
        const entity = new Entity({ scene: this, parent, components: entity_cores[0], options });
        this._dispatchEvent(new EntitiesCreatedEvent({ entities: [entity], emitter: null }));
        return entity;
    }

    /**
     * Create multiple entities at once.
     * This method is more efficient than calling `newEntity` multiple times.
     * It creates all entities in a single call to the core.
     *
     * @param params
     * @param params.components_array - An array of objects with the name and components of each entity.
     * @param params.options - Additional options for the entity creation.
     *
     * @returns A promise that resolves to an array of the created entities.
     */
    async newEntities({
        components_array,
        options,
    }: {
        components_array: Array<ComponentsManifest>;
        options?: EntityCreationOptions;
    }): Promise<Array<Entity>> {
        const entity_cores = await this.#core.createEntities({
            components: components_array,
            delete_on_client_disconnection: options?.delete_on_client_disconnection ?? false,
            is_transient: true,
        });

        //TODO: compute each entity's parent
        const entities = entity_cores.map(components => new Entity({ scene: this, parent: null, components, options }));
        this._dispatchEvent(new EntitiesCreatedEvent({ entities, emitter: null }));
        return entities;
    }

    /**
     * Find an entity by its UUID and linkage.
     *
     * @param params
     * @param params.entity_uuid - The UUID of the entity to find.
     * @param params.linkage - The linkage of the entity to find.
     *
     * @returns A promise that resolves to the found entity or null if not found.
     */
    async findEntity({
        entity_uuid,
        linkage = [],
    }: {
        entity_uuid: UUID;
        linkage?: Array<UUID>;
    }): Promise<Entity | null> {
        const foundEntity = this._entity_registry
            .find({ entity_euid: entity_uuid })
            .find(
                entity =>
                    (entity.lineage?.value?.length ?? 0) === linkage.length &&
                    (entity.lineage?.value ?? []).every((uuid, i) => uuid === linkage[i]),
            );

        if (foundEntity) {
            return foundEntity;
        }

        const entity_reponses = await this.#core.findEntities({
            query: { euid: entity_uuid, linkage },
            options: { include_ancestors: true },
        });

        if (entity_reponses.length === 0) {
            return null;
        }

        return this.#resolveEntityResponse(entity_reponses[0]);
    }

    /**
     * Find entities by their UUID.
     *
     * This can return multiple entities if the entity is a child of a {@link Components.SceneRef}
     * that is instanced multiple times.
     *
     * @param params
     * @param params.entity_uuid - The UUID of the entity to find.
     *
     * @returns A promise that resolves to an array of entities with the given UUID.
     */
    async findEntities({ entity_uuid }: { entity_uuid: UUID }): Promise<Array<Entity>> {
        const foundEntities = this._entity_registry.find({ entity_euid: entity_uuid });
        if (foundEntities.length > 0) {
            return foundEntities;
        }

        const entity_responses = await this.#core.findEntities({
            query: { euid: entity_uuid },
            options: { include_ancestors: true },
        });
        return this.#resolveEntityResponses({ entity_responses });
    }

    /**
     * Delete a batch of entities.
     *
     * @param params
     * @param params.entities - The entities to delete.
     *
     * @returns A promise that resolves when the entities are deleted.
     */
    async deleteEntities({ entities }: { entities: Array<Entity> }): Promise<void> {
        await this.#core.deleteEntities({ entity_uuids: entities.map(e => e.id) });
        for (const entity of entities) {
            this._entity_registry.remove({ entity });
        }
    }

    /**
     * Highlight a batch of entities.
     *
     * @param params
     * @param params.entities - The entities to highlight.
     * @param params.keep_old_selection - Whether to keep the old selection or not.
     *
     * @returns A promise that resolves when the message is sent.
     */
    async highlightEntities({
        entities,
        keep_old_selection = false,
    }: {
        entities: Array<Entity>;
        keep_old_selection?: boolean;
    }): Promise<void> {
        this.#core.highlightEntities({
            highlightEntitiesMessage: {
                entities: entities.map(e => e.rtid),
                keep_old_selection,
            },
        });
    }

    /**
     * Fire a script event.
     *
     * @param params
     * @param params.event_map_id - The UUID of the event map.
     * @param params.event_name - The name of the event.
     * @param params.emitter_entity - The entity that emits the event.
     * @param params.target_entities - The entities that are the target of the event. Leave empty for global events.
     * @param params.data_object - The data object to pass with the event.
     *
     * @returns A promise that resolves when the message is sent.
     *
     * @experimental
     */
    fireEvent({
        event_map_id,
        event_name,
        emitter_entity,
        target_entities = [],
        data_object = {},
    }: {
        event_map_id: UUID;
        event_name: string;
        emitter_entity?: Entity;
        target_entities?: Array<Entity>;
        data_object?: ScriptDataObject;
    }): void {
        this.#core.fireEvent({
            event_map_id,
            event_name,
            emitter_entity: emitter_entity ? emitter_entity.rtid : 0n,
            target_entities: target_entities.map(e => e.rtid),
            data_object,
        });
    }

    /**
     * @experimental
     */
    setFilter({ name, value }: { name: string; value: string }): void {
        const rpn = compute_rpn(value);
        this.#core.setFilter({ name, rpn });
    }

    /**
     * @experimental
     */
    toggleFilter({ name, enabled }: { name: string; enabled: boolean }): void {
        this.#core.toggleFilter({ name, enabled });
    }

    /**
     * @experimental
     */
    removeFilter({ name }: { name: string }): void {
        this.#core.removeFilter({ name });
    }

    /**
     *  @deprecated
     */
    async findEntitiesByNames({ entity_names }: { entity_names: Array<string> }): Promise<Array<Entity>> {
        const entity_responses = await this.#core.findEntities({
            query: { names: entity_names },
            options: { include_ancestors: true },
        });
        return this.#resolveEntityResponses({ entity_responses });
    }

    /**
     *  @deprecated
     */
    async findEntitiesWithComponents({
        mandatory_components,
        forbidden_components,
    }: {
        mandatory_components: Array<ComponentName>;
        forbidden_components?: Array<ComponentName>;
    }): Promise<Array<Entity>> {
        const entity_responses = await this.#core.findEntities({
            query: { mandatory_components, forbidden_components },
            options: { include_ancestors: true },
        });
        return this.#resolveEntityResponses({ entity_responses });
    }

    /**
     * @internal
     *
     * Get an entity by its RTID.
     */
    async _findEntity({ entity_rtid }: { entity_rtid: RTID }): Promise<Entity | null> {
        if (entity_rtid === 0n) {
            return null;
        }

        const entity = this._entity_registry.get({ entity_rtid });
        if (entity) {
            return entity;
        }

        let promise = this.#pending_entity_requests.get(entity_rtid);
        if (!promise) {
            promise = this.#core.findEntities({ query: { rtid: entity_rtid } });
            this.#pending_entity_requests.set(entity_rtid, promise);
        }

        const entity_responses = await promise;
        this.#pending_entity_requests.delete(entity_rtid);
        if (entity_responses.length === 0) {
            return null;
        }

        return this.#resolveEntityResponse(entity_responses[0]);
    }

    /**
     * @internal
     */
    async _getChildren({ entity }: { entity: Entity }): Promise<Array<Entity>> {
        const children_components = await this.#core.getChildren({ entity_rtid: entity.rtid });
        return children_components.map(
            components =>
                this._entity_registry.get({ entity_rtid: components.euid.rtid }) ??
                new Entity({ scene: this, parent: entity, components }),
        );
    }

    /**
     * @internal
     */
    _assignClientToScripts({
        client_uuid,
        entity_rtid,
        script_uuid,
    }: {
        client_uuid: UUID;
        entity_rtid: RTID;
        script_uuid: UUID;
    }): void {
        this.#core.assignClientToScript({ client_uuid, script_uuid, entity_rtid });
    }

    /**
     * @internal
     */
    async _setEntityVisibility({ entity_rtid, is_visible }: { entity_rtid: RTID; is_visible: boolean }): Promise<void> {
        return this.#core.setEntityVisibility({ entity_rtid, is_visible });
    }

    /**
     * @internal
     */
    _onEntityVisibilityChanged = ({ entity_rtid, is_visible }: Events.EntityVisibilityChangedEvent): void => {
        const entity = this._entity_registry.get({ entity_rtid });
        if (entity) {
            entity._onVisibilityChanged({ is_visible });

            for (const child_rtid of entity.children_rtid) {
                this._setEntityVisibility({ entity_rtid: child_rtid, is_visible });
            }
        }
    };

    /**
     * @internal
     */
    _onEntitiesCreated = async ({ created_entities, emitter }: Events.EntitiesCreatedEvent): Promise<void> => {
        const entities: Array<Entity> = [];

        for (const [parent_rtid, children] of created_entities.entries()) {
            const parent: Entity | null =
                parent_rtid !== 0n ? await this._findEntity({ entity_rtid: parent_rtid }) : null;

            for (const entity of children) {
                entities.push(new Entity({ scene: this, parent, components: entity }));
            }
        }

        this._dispatchEvent(new EntitiesCreatedEvent({ entities, emitter: this._resolveEmitter(emitter) }));
    };

    /**
     * @internal
     */
    _onEntitiesDeleted = ({
        deleted_entity_euids,
        deleted_entity_rtids,
        emitter,
    }: Events.EntitiesDeletedEvent): void => {
        const entity_ids = Array<RTID>();
        for (const entity_euid of deleted_entity_euids) {
            const entities = this._entity_registry.find({ entity_euid });
            for (const entity of entities) {
                this._entity_registry.remove({ entity });
                entity_ids.push(entity.rtid);
            }
        }

        for (const entity_rtid of deleted_entity_rtids) {
            const entity = this._entity_registry.get({ entity_rtid });
            if (entity) {
                this._entity_registry.remove({ entity });
                entity_ids.push(entity.rtid);
            }
        }

        this._dispatchEvent(new EntitiesDeletedEvent({ entity_ids, emitter: this._resolveEmitter(emitter) }));
    };

    /**
     * @internal
     */
    _updateEntityFromEvent({
        entity_euid,
        updated_components,
        deleted_components,
        emitter,
    }: {
        entity_euid: UUID;
        updated_components: Partial<ComponentsRecord>;
        deleted_components?: Array<ComponentName>;
        emitter: Events.Emitter | null;
    }): void {
        const entities = this._entity_registry.find({ entity_euid });

        if (entities.length === 0) {
            console.log("Received an update for an undiscovered entity", entity_euid);
            return;
        }

        for (const entity of entities) {
            if (updated_components.lineage) {
                this.#onEntityReparentedByEuid({
                    entity,
                    new_parent_euid: updated_components.lineage.parentUUID ?? null,
                });
            }

            entity._applyComponentsUpdate({
                components: updated_components,
                deleted_components,
                dispatch_event: true,
                emitter,
            });
        }
    }

    /**
     * @internal
     */
    _onEntityReparented = (): void => {
        this.#instance._updateEntities();
    };

    /**
     *
     */
    #onEntityReparentedByEuid = async ({
        entity,
        new_parent_euid,
    }: {
        entity: Entity;
        new_parent_euid: UUID | null;
    }): Promise<void> => {
        if (!new_parent_euid) {
            entity._set_parent(null);
            return;
        }

        const parent_entities = await this.findEntities({ entity_uuid: new_parent_euid });
        const entityLineage = entity.lineage;
        if (!entityLineage) {
            entity._set_parent(parent_entities[0] ?? null);
            return;
        }

        const parentEntity = parent_entities.find(parent => {
            if (!parent.lineage) {
                return false;
            }
            return parent.lineage.value.every((linkerEUID, i) => linkerEUID === entityLineage.value[i]);
        });

        entity._set_parent(parentEntity ?? null);
    };

    /**
     * @internal
     */
    _onScriptEventReceived = ({
        emitter_rtid,
        event_name,
        target_rtids,
        data_object,
    }: Events.ScriptEventTriggeredEvent): void => {
        const emitter_entity = this._entity_registry.get({ entity_rtid: emitter_rtid });
        if (emitter_entity) {
            emitter_entity._onScriptEventEmitted({ scene: this, event_name, target_rtids, data_object });
        }

        const script_event_received_event = new ScriptEventReceived({ event_name, emitter_entity, data_object });

        for (const entity_rtid of target_rtids) {
            const target_entity = this._entity_registry.get({ entity_rtid });
            if (target_entity) {
                target_entity._onScriptEventReceived({ script_event_received_event });
            }
        }
    };

    /**
     * @internal
     */
    _sanitizeComponentValue<_ComponentName extends ComponentName>({
        component_name,
        value,
    }: {
        component_name: _ComponentName;
        value: Partial<ComponentType<_ComponentName>> | undefined;
    }): ComponentType<_ComponentName> {
        return this.#core.sanitizeComponentValue({ component_name, value });
    }

    /**
     *
     */
    #resolveEntityResponses({ entity_responses }: { entity_responses: Array<EntityResponse> }): Array<Entity> {
        return entity_responses.map(this.#resolveEntityResponse);
    }

    /**
     *
     */
    #resolveEntityResponse = (entity_response: EntityResponse): Entity => {
        const entity = this._entity_registry.get({ entity_rtid: entity_response.components.euid.rtid });
        if (entity) {
            return entity;
        }

        const parent: Entity | null = entity_response.ancestors
            ? this.#resolveEntityAncestors(entity_response.ancestors)
            : null;

        return new Entity({
            scene: this,
            parent,
            components: entity_response.components,
            is_visible: entity_response.is_visible,
            children_rtid: entity_response.children_rtid,
        });
    };

    /**
     *
     */
    #resolveEntityAncestors = (ancestors: EntityResponse[]): Entity | null => {
        let current_parent: Entity | null = null;

        for (const ancestor of ancestors) {
            const entity = this._entity_registry.get({ entity_rtid: ancestor.components.euid.rtid });
            if (entity) {
                current_parent = entity;
            } else {
                current_parent = new Entity({
                    scene: this,
                    parent: current_parent,
                    components: ancestor.components,
                    is_visible: ancestor.is_visible,
                    children_rtid: ancestor.children_rtid,
                });
            }
        }

        return current_parent;
    };

    /**
     * @internal
     */
    _resolveEmitter(emitter: Events.Emitter | null): Client | null {
        if (emitter === null) {
            return null;
        }

        if (emitter.session_id !== this.#instance.session.session_id) {
            return new Client({
                core: this.#instance,
                client_info: emitter,
                session_id: emitter.session_id,
            });
        }

        return this.#instance.session.getClient(emitter);
    }

    /**
     * Get the current scene settings.
     *
     * @returns The current scene settings.
     */
    async getSettings(): Promise<SceneSettingsRecord> {
        await this.#settings_promise;
        return this.#settings!;
    }

    /**
     * @internal
     */
    _onSceneSettingsUpdated = ({ updated_settings }: Events.SceneSettingsUpdatedEvent): void => {
        if (!this.#settings) {
            this.#settings = updated_settings as SceneSettingsRecord;

            if (!this.#settings_promise_resolver) {
                throw new Error("Settings promise resolver is null when settings are first set.");
            }

            this.#settings_promise_resolver();
            this.#settings_promise_resolver = null;

            return;
        }

        for (const [key, value] of Object.entries(updated_settings)) {
            Object.assign(this.#settings[key as keyof SceneSettingsRecord], value);
        }

        this._dispatchEvent(new SceneSettingsUpdatedEvent({ updated_settings, emitter: null }));
    };
}

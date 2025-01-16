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
    Events,
    ComponentsRecord,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Entity } from "./Entity";
import { compute_rpn } from "./Filters";
import { EntityRegistry } from "./EntityRegistry";

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

    /**
     * @deprecated
     * Whether to update the entity automatically.
     */
    auto_update?: boolean;
};

/**
 *
 */
const PHYSICS_EVENT_MAP_ID = "7a8cc05e-8659-4b23-99d1-1352d13e2020" as const;

/**
 * The scene class.
 *
 * It is the main entry point to interact with the entities in the scene.
 * It is responsible for creating, finding, and deleting entities.
 *
 * This class is not meant to be instantiated directly.
 * Instead, it is created by the {@link Livelink} instance and can be accessed through the
 * {@link Livelink.scene} property.
 *
 * @category Scene
 */
export class Scene {
    /**
     * The core instance.
     */
    #core: LivelinkCore;

    /**
     * @internal
     * Registry of entities discovered until now.
     */
    public readonly _entity_registry = new EntityRegistry();

    /**
     * The pending entity requests.
     * Used to avoid duplicate requests for the same entity.
     */
    #pending_entity_requests = new Map<RTID, Promise<Array<EntityResponse>>>();

    /**
     * @internal
     */
    constructor(core: LivelinkCore) {
        this.#core = core;
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
        return new Entity({ scene: this, parent, components: entity_cores[0], options });
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
        return entity_cores.map(components => new Entity({ scene: this, parent: null, components, options }));
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
     *
     */
    #resolveEntityResponses({ entity_responses }: { entity_responses: Array<EntityResponse> }): Array<Entity> {
        return entity_responses.map(this.#resolveEntityResponse);
    }

    /**
     *
     */
    #resolveEntityResponse = (entity_response: EntityResponse): Entity => {
        let parent: Entity | null = null;

        if (entity_response.ancestors) {
            for (const ancestor of entity_response.ancestors) {
                parent = this.#resolveEntityResponse(ancestor);
            }
        }

        const entity = this._entity_registry.get({ entity_rtid: entity_response.components.euid.rtid });
        if (entity) {
            return entity;
        }

        return new Entity({ scene: this, parent, components: entity_response.components });
    };

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
    _onScriptEventReceived = async (event: Events.ScriptEventTriggeredEvent): Promise<void> => {
        if (event.emitter_rtid === 0n) {
            return;
        }

        const emitter = this._entity_registry.get({ entity_rtid: event.emitter_rtid });

        // Handle physics events
        if (event.event_name.startsWith(PHYSICS_EVENT_MAP_ID)) {
            return this.#handlePhysicsScriptEvent({ event, emitter });
        }

        // Handle custom script events
        const target_entities = event.target_rtids
            .map(rtid => this._entity_registry.get({ entity_rtid: rtid }))
            .filter(e => e !== null) as Array<Entity>;

        target_entities.forEach(target => {
            target._onScriptEventTarget({
                event_name: event.event_name,
                data_object: event.data_object as ScriptDataObject,
                emitter_rtid: event.emitter_rtid,
            });
        });

        emitter?._onScriptEventEmitter({
            event_name: event.event_name,
            data_object: event.data_object as ScriptDataObject,
            target_rtids: event.target_rtids,
        });
    };

    /**
     * @internal
     */
    async _getChildren({ entity }: { entity: Entity }): Promise<Array<Entity>> {
        const children_components = await this.#core.getChildren({ entity_rtid: entity.rtid });
        return children_components.map(components => new Entity({ scene: this, parent: entity, components }));
    }

    /**
     * @internal
     */
    async _assignClientToScripts({
        client_uuid,
        entity_rtid,
        script_uuid,
    }: {
        client_uuid: UUID;
        entity_rtid: RTID;
        script_uuid: UUID;
    }): Promise<void> {
        return this.#core.assignClientToScript({ client_uuid, script_uuid, entity_rtid });
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
    async _onEntityVisibilityChanged({
        entity_rtid,
        is_visible,
    }: {
        entity_rtid: RTID;
        is_visible: boolean;
    }): Promise<void> {
        const entity = this._entity_registry.get({ entity_rtid });
        if (entity) {
            entity._onVisibilityChanged({ is_visible });
        }
    }

    /**
     * @internal
     */
    _updateEntityFromEvent({
        entity_euid,
        updated_components,
    }: {
        entity_euid: UUID;
        updated_components: Partial<ComponentsRecord>;
    }): void {
        const entities = this._entity_registry.find({ entity_euid });

        if (entities.length === 0) {
            console.log("Received an update for an undiscovered entity", entity_euid);
            return;
        }

        for (const entity of entities) {
            entity._mergeComponents({ components: updated_components, dispatch_event: true });
        }
    }

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
    async #handlePhysicsScriptEvent({
        emitter,
        event,
    }: {
        emitter: Entity | null;
        event: Events.ScriptEventTriggeredEvent;
    }): Promise<void> {
        // if the emitter entity is not found,
        // it means that the entity does not have any event listeners, therefore nobody
        // is interested in the event.
        if (!emitter) {
            return;
        }

        const entity = await this.#extractEntityFromEventDataObject({
            data_object: event.data_object,
            entity_name: "hEntity",
        });

        if (!entity) {
            return;
        }

        /*
        switch (event.event_name) {
            case `${PHYSICS_EVENT_MAP_ID}/enter_trigger`:
                emitter.onTriggerEntered({ entity });
                break;

            case `${PHYSICS_EVENT_MAP_ID}/exit_trigger`:
                emitter.onTriggerExited({ entity });
                break;
        }
        */
        return;
    }

    /**
     *
     */
    async #extractEntityFromEventDataObject({
        data_object,
        entity_name,
    }: {
        data_object: ScriptDataObject;
        entity_name: string;
    }): Promise<Entity | null> {
        const entity_ref = data_object[entity_name];
        return typeof entity_ref === "object" && "originalEUID" in entity_ref
            ? this.findEntity({ entity_uuid: entity_ref.originalEUID, linkage: entity_ref.linkage })
            : null;
    }
}

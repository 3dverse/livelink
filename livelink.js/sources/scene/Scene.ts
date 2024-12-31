//------------------------------------------------------------------------------
import type {
    LivelinkCore,
    RTID,
    UUID,
    EntityCreationCoreOptions,
    ScriptEvent,
    ComponentType,
    ComponentsRecord,
    ScriptDataObject,
    Components,
} from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Entity } from "./Entity";
import { compute_rpn } from "./Filters";
import { SceneSettings } from "./SceneSettings";
import { EntityRegistry } from "./EntityRegistry";

/**
 * @inline
 * @category Scene
 */
export type EntityCreationOptions = EntityCreationCoreOptions & {
    disable_proxy?: boolean;
    auto_broadcast?: boolean;
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
export class Scene extends EventTarget {
    /**
     * Scene settings
     */
    public readonly settings = new SceneSettings();

    /**
     * The core instance.
     */
    #core: LivelinkCore;

    /**
     * @internal
     * Registry of entities discovered until now.
     */
    public readonly entity_registry = new EntityRegistry();

    /**
     * The pending entity requests.
     * Used to avoid duplicate requests for the same entity.
     */
    #pending_entity_requests = new Map<RTID, Promise<unknown>>();

    /**
     * @internal
     */
    constructor(core: LivelinkCore) {
        super();
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
    }: {
        name: string;
        components: Partial<ComponentsRecord>;
        options?: EntityCreationOptions;
    }): Promise<Entity> {
        const components_with_euid = await this.#core.spawnEntity({
            components: { debug_name: { value: name }, ...components },
            options,
        });
        return this.#createEntityProxy({ components: components_with_euid, options });
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
        components_array: Array<Partial<ComponentsRecord> & { euid?: { value: UUID } }>;
        options?: EntityCreationOptions;
    }): Promise<Array<Entity>> {
        const components_with_euid_array = await this.#core.createEntities({
            components: components_array,
            options,
        });

        return components_with_euid_array.map(components => this.#createEntityProxy({ components, options }));
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
        const foundEntity = this.entity_registry
            .find({ entity_euid: entity_uuid })
            .find(
                entity =>
                    (entity.lineage?.value?.length ?? 0) === linkage.length &&
                    (entity.lineage?.value ?? []).every((uuid, i) => uuid === linkage[i]),
            );

        if (foundEntity) {
            return foundEntity;
        }

        const editor_entity = await this.#core.getEntity({ entity_uuid, linkage });
        if (!editor_entity) {
            return null;
        }

        const entities = await this.#addEditorEntities({
            editor_entities: [editor_entity],
            resolve_ancestors: true,
        });
        return entities[0];
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
        const foundEntities = this.entity_registry.find({ entity_euid: entity_uuid });
        if (foundEntities.length > 0) {
            return foundEntities;
        }

        const editor_entities = await this.#core.findEntitiesByEUID({ entity_uuid });
        if (editor_entities.length === 0) {
            return [];
        }

        return this.#addEditorEntities({ editor_entities, resolve_ancestors: true });
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
        await this.#core.deleteEntities({ entity_uuids: entities.map(e => e.id!) });
        for (const entity of entities) {
            this.entity_registry.remove({ entity });
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
                entities: entities.map(e => e.rtid!),
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
            emitter_entity: emitter_entity ? emitter_entity.rtid! : 0n,
            target_entities: target_entities.map(e => e.rtid!),
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
        const editor_entities = await this.#core.findEntitiesByNames({
            entity_names,
        });

        return this.#addEditorEntities({ editor_entities, resolve_ancestors: true });
    }

    /**
     *  @deprecated
     */
    async findEntitiesWithComponents({
        mandatory_components,
        forbidden_components,
    }: {
        mandatory_components: Array<ComponentType>;
        forbidden_components?: Array<ComponentType>;
    }): Promise<Array<Entity>> {
        const editor_entities = await this.#core.findEntitiesWithComponents({
            mandatory_components,
            forbidden_components,
        });
        return this.#addEditorEntities({ editor_entities, resolve_ancestors: true });
    }

    /**
     * @internal
     *
     * Get an entity by its RTID.
     */
    async _getEntity({ entity_rtid }: { entity_rtid: RTID }): Promise<Entity | null> {
        if (entity_rtid === 0n) {
            return null;
        }

        const entity = this.entity_registry.get({ entity_rtid });
        if (entity) {
            return entity;
        }

        let promise = this.#pending_entity_requests.get(entity_rtid);
        if (!promise) {
            promise = this.#resolveAncestors({ entity_rtid });
            this.#pending_entity_requests.set(entity_rtid, promise);
        }

        await promise;
        this.#pending_entity_requests.delete(entity_rtid);

        return this.entity_registry.get({ entity_rtid });
    }

    /**
     * @internal
     */
    _onScriptEventReceived = async (e: Event): Promise<void> => {
        const event = (e as CustomEvent<ScriptEvent>).detail;

        if (event.emitter_rtid === 0n) {
            return;
        }

        const emitter = this.entity_registry.get({ entity_rtid: event.emitter_rtid });

        // Handle physics events
        if (event.event_name.startsWith(PHYSICS_EVENT_MAP_ID)) {
            return this.#handlePhysicsScriptEvent({ event, emitter });
        }

        // Handle custom script events
        const target_entities = event.target_rtids
            .map(rtid => this.entity_registry.get({ entity_rtid: rtid }))
            .filter(e => e !== null) as Array<Entity>;

        target_entities.forEach(target => {
            target.onScriptEventTarget({
                event_name: event.event_name,
                data_object: event.data_object as ScriptDataObject,
                emitter_rtid: event.emitter_rtid,
            });
        });

        emitter?.onScriptEventEmitter({
            event_name: event.event_name,
            data_object: event.data_object as ScriptDataObject,
            target_rtids: event.target_rtids,
        });
    };

    /**
     * @internal
     */
    async _getChildren({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<Entity>> {
        const editor_entities = await this.#core.getChildren({ entity_rtid });
        const children = await this.#addEditorEntities({ editor_entities, resolve_ancestors: false });
        children.forEach(child => child._setParent(this.entity_registry.get({ entity_rtid })!));
        return children;
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
        const entity = this.entity_registry.get({ entity_rtid });
        if (entity) {
            entity._onVisibilityChanged({ is_visible });
        }
    }

    /**
     *
     */
    #createEntityProxy = ({
        components,
        options,
    }: {
        components: Partial<ComponentsRecord> & { euid: Components.Euid };
        options?: EntityCreationOptions;
    }): Entity => {
        const entity = new Entity({ scene: this, components, options });
        return new Proxy(entity, Entity.handler);
    };

    /**
     *
     */
    #addEditorEntities({
        responses,
        resolve_ancestors,
    }: {
        responses: Array<{
            entity: Partial<ComponentsRecord> & { euid: Components.Euid };
            ancestors: Array<Partial<ComponentsRecord> & { euid: Components.Euid }>;
        }>;
        resolve_ancestors: boolean;
    }): Promise<Array<Entity>> {
        const resolveEntities = responses.map(async res => {
            const entity_rtid = BigInt(res.entity.euid.rtid);
            let entity = this.entity_registry.get({ entity_rtid });

            if (!entity) {
                entity = this.#createEntityProxy({ components: res.entity });

                if (resolve_ancestors) {
                    await this.#resolveAncestors({ entity_rtid });
                }
            }

            return entity;
        });
        return Promise.all(resolveEntities);
    }

    /**
     *  Add ancestors to the entity registry.
     */
    async #resolveAncestors({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<ComponentsRecord>> {
        const ancestor_editor_entities = await this.#core.resolveAncestors({ entity_rtid });

        await this.#addEditorEntities({
            responses: ancestor_editor_entities,
            resolve_ancestors: false,
        });

        ancestor_editor_entities.forEach(ancestor_editor_entity => {
            const ancestor_entity = this.entity_registry.get({
                entity_rtid: BigInt(ancestor_editor_entity.rtid),
            });

            ancestor_editor_entity.children.forEach(child_rtid => {
                const child_entity = this.entity_registry.get({ entity_rtid: BigInt(child_rtid) });
                child_entity?._setParent(ancestor_entity);
            });
        });

        return ancestor_editor_entities;
    }

    /**
     *
     */
    async #handlePhysicsScriptEvent({ emitter, event }: { emitter: Entity | null; event: ScriptEvent }): Promise<void> {
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

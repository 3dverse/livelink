import type {
    LivelinkCore,
    RTID,
    UUID,
    EntityCreationOptions as EntityCreationOptionsBase,
    ScriptEvent,
    EditorEntity,
    ComponentType,
} from "@3dverse/livelink.core";
import { Entity } from "./Entity";
import { EntityRegistry } from "./EntityRegistry";
import { Settings } from "./Settings";

export type EntityCreationOptions = EntityCreationOptionsBase & {
    disable_proxy?: boolean;
};

const PHYSICS_EVENT_MAP_ID = "7a8cc05e-8659-4b23-99d1-1352d13e2020";

/**
 *
 */
export class Scene extends EventTarget {
    /**
     *
     */
    #core: LivelinkCore;

    /**
     * Registry of entities discovered until now.
     */
    public readonly entity_registry = new EntityRegistry();

    /**
     * Scene settings
     */
    public readonly settings = new Settings();

    /**
     *
     */
    constructor(core: LivelinkCore) {
        super();
        this.#core = core;
    }

    /**
     *
     */
    async getEntity({ entity_rtid }: { entity_rtid: RTID }): Promise<Entity | null> {
        if (entity_rtid === 0n) {
            return null;
        }

        const entity = this.entity_registry.get({ entity_rtid });
        if (entity) {
            return entity;
        }
        await this.resolveAncestors({ entity_rtid });
        return this.entity_registry.get({ entity_rtid });
    }

    /**
     *
     */
    async newEntity<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        name: string,
        options?: EntityCreationOptions,
    ): Promise<EntityType> {
        let entity = new entity_type(this).init(name);
        entity = new Proxy(entity, Entity.handler) as EntityType;
        entity.onCreate();
        await entity._instantiate(
            this.#core.spawnEntity({ entity, options }),
            options?.disable_proxy === true ? "off" : "on",
        );
        return entity;
    }

    /**
     *
     */
    async newEntities<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        entity_names: Array<string>,
        options?: EntityCreationOptions,
    ): Promise<Array<EntityType>> {
        const entities = entity_names.map((name, index) => {
            let entity = new entity_type(this).init(name, `entity_${index}`);
            entity = new Proxy(entity, Entity.handler) as EntityType;
            entity.onCreate();
            return entity;
        });

        const promise = this.#core.createEntities({ entities, options });

        for (let i = 0; i < entities.length; i++) {
            await entities[i]._instantiate(
                promise.then(editor_entities => editor_entities[i]),
                options?.disable_proxy === true ? "off" : "on",
            );
        }

        return entities;
    }

    /**
     *
     */
    async findEntities<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        {
            entity_uuid,
        }: {
            entity_uuid: UUID;
        },
    ): Promise<Array<EntityType>> {
        const foundEntities = this.entity_registry.find({ entity_euid: entity_uuid });
        if (foundEntities.length > 0) {
            return foundEntities as Array<EntityType>;
        }

        const editor_entities = await this.#core.findEntitiesByEUID({ entity_uuid });

        if (editor_entities.length === 0) {
            return [];
        }

        return this.#addEditorEntities(entity_type, { editor_entities, resolve_ancestors: true });
    }

    /**
     *
     */
    async findEntity<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        {
            entity_uuid,
            linkage = [],
        }: {
            entity_uuid: UUID;
            linkage?: Array<UUID>;
        },
    ): Promise<EntityType | null> {
        const foundEntity = this.entity_registry
            .find({ entity_euid: entity_uuid })
            .find(
                entity =>
                    (entity.lineage?.value?.length ?? 0) === linkage.length &&
                    (entity.lineage?.value ?? []).every((uuid, i) => uuid === linkage[i]),
            );

        if (foundEntity) {
            return foundEntity as EntityType;
        }

        const entity_entity = await this.#core.getEntity({ entity_uuid, linkage });
        if (!entity_entity) {
            return null;
        }

        return this.#addEditorEntities(entity_type, { editor_entities: [entity_entity], resolve_ancestors: true })[0];
    }

    /**
     *  @deprecated
     */
    async findEntitiesWithComponents<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        {
            mandatory_components,
            forbidden_components,
        }: {
            mandatory_components: Array<ComponentType>;
            forbidden_components?: Array<ComponentType>;
        },
    ): Promise<Array<EntityType>> {
        const editor_entities = await this.#core.findEntitiesWithComponents({
            mandatory_components,
            forbidden_components,
        });
        return this.#addEditorEntities(entity_type, { editor_entities, resolve_ancestors: true });
    }

    /**
     *  @deprecated
     */
    async findEntitiesByNames<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        { entity_names }: { entity_names: Array<string> },
    ): Promise<Array<EntityType>> {
        const editor_entities = await this.#core.findEntitiesByNames({
            entity_names,
        });

        return this.#addEditorEntities(entity_type, { editor_entities, resolve_ancestors: true });
    }

    /**
     *
     */
    async deleteEntities({ entities }: { entities: Array<Entity> }): Promise<void> {
        await this.#core.deleteEntities({ entity_uuids: entities.map(e => e.id!) });
        for (const entity of entities) {
            this.entity_registry.remove({ entity });
        }
    }

    /**
     *
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
     *
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
        data_object?: Record<string, unknown>;
    }) {
        return this.#core.fireEvent({
            event_map_id,
            event_name,
            emitter_entity: emitter_entity ? emitter_entity.rtid! : 0n,
            target_entities: target_entities.map(e => e.rtid!),
            data_object,
        });
    }

    /**
     * @internal
     */
    _onScriptEventReceived = async (e: Event) => {
        const event = (e as CustomEvent<ScriptEvent>).detail;

        if (event.emitter_rtid === 0n) {
            return;
        }

        const emitter = this.entity_registry.get({ entity_rtid: event.emitter_rtid });

        // Handle physics events
        if (event.event_name.startsWith(PHYSICS_EVENT_MAP_ID)) {
            return this.handlePhysicsScriptEvent({ event, emitter });
        }

        // Handle custom script events
        const target_entities = event.target_rtids
            .map(rtid => this.entity_registry.get({ entity_rtid: rtid }))
            .filter(e => e !== null) as Array<Entity>;

        target_entities.forEach(target => {
            target.onScriptEventTarget({
                event_name: event.event_name,
                data_object: event.data_object,
                emitter_rtid: event.emitter_rtid,
            });
        });

        emitter?.onScriptEventEmitter({
            event_name: event.event_name,
            data_object: event.data_object,
            target_rtids: event.target_rtids,
        });
    };

    /**
     *
     */
    async handlePhysicsScriptEvent({ emitter, event }: { emitter: Entity | null; event: ScriptEvent }) {
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

        switch (event.event_name) {
            case `${PHYSICS_EVENT_MAP_ID}/enter_trigger`:
                emitter.onTriggerEntered({ entity });
                break;

            case `${PHYSICS_EVENT_MAP_ID}/exit_trigger`:
                emitter.onTriggerExited({ entity });
                break;
        }
        return;
    }

    /**
     *
     */
    async #extractEntityFromEventDataObject({
        data_object,
        entity_name,
    }: {
        data_object: Record<string, {}> | null;
        entity_name: string;
    }): Promise<Entity | null> {
        if (!data_object?.hasOwnProperty(entity_name)) {
            return null;
        }
        const entity_ref = data_object[entity_name] as { linkage: Array<UUID>; originalEUID: UUID };
        return this.findEntity(Entity, { entity_uuid: entity_ref.originalEUID, linkage: entity_ref.linkage });
    }

    /**
     * @internal
     */
    async _createEntity({
        entity,
        options,
    }: {
        entity: Entity;
        options?: EntityCreationOptions;
    }): Promise<EditorEntity> {
        return this.#core.spawnEntity({ entity, options });
    }

    /**
     * @internal
     */
    async _createEntities({
        entities,
        options,
    }: {
        entities: Array<Entity>;
        options?: EntityCreationOptions;
    }): Promise<Array<EditorEntity>> {
        return this.#core.createEntities({ entities, options });
    }

    /**
     *
     */
    #addEditorEntities<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        {
            editor_entities,
            resolve_ancestors,
        }: {
            editor_entities: Array<EditorEntity>;
            resolve_ancestors: boolean;
        },
    ): Array<EntityType> {
        const entities = editor_entities.map(editor_entity => {
            let entity = this.entity_registry.get({ entity_rtid: BigInt(editor_entity.rtid) }) as EntityType | null;

            if (!entity) {
                entity = new Proxy(new entity_type(this).init(editor_entity), Entity.handler) as EntityType;

                this.entity_registry.add({ entity });

                if (resolve_ancestors) {
                    this.resolveAncestors({ entity_rtid: BigInt(editor_entity.rtid) });
                }
            }
            return entity;
        });

        return entities;
    }

    /**
     * @internal
     */
    async _getChildren({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<Entity>> {
        const editor_entities = await this.#core.getChildren({ entity_rtid });
        const children = this.#addEditorEntities(Entity, { editor_entities, resolve_ancestors: false });
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
     *  Add ancestors to the entity registry.
     */
    async resolveAncestors({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<EditorEntity>> {
        const ancestor_editor_entities = await this.#core.resolveAncestors({ entity_rtid: BigInt(entity_rtid) });

        this.#addEditorEntities(Entity, {
            editor_entities: ancestor_editor_entities,
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
}

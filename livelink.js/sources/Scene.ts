import type {
    LivelinkCore,
    RTID,
    UUID,
    EntityCreationOptions,
    ScriptEvent,
    EditorEntity,
} from "@3dverse/livelink.core";
import { Entity } from "./Entity";
import { EntityRegistry } from "./EntityRegistry";
import { AnimationSequence } from "./AnimationSequence";

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

        const editor_entities = await this.#core._resolveAncestors({ entity_rtid });
        this.#addEditorEntities(Entity, { editor_entities });
        return this.entity_registry.get({ entity_rtid });
    }

    /**
     *
     */
    getAnimationSequence({ animation_sequence_id }: { animation_sequence_id: UUID }) {
        return new AnimationSequence(this.#core, { animation_sequence_id });
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
        await entity._instantiate(options);
        return entity;
    }

    /**
     *
     */
    async findEntity<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        {
            entity_uuid,
        }: {
            entity_uuid: UUID;
        },
    ): Promise<EntityType | null> {
        const foundEntities = this.entity_registry.find({ entity_euid: entity_uuid });
        if (foundEntities.length > 0) {
            return foundEntities[0] as EntityType;
        }

        const editor_entities = await this.#core._findEntitiesByEUID({
            entity_uuid,
        });

        if (editor_entities.length === 0) {
            return null;
        }

        const entities = this.#addEditorEntities(entity_type, { editor_entities });
        return entities[0];
    }

    /**
     *
     */
    async deleteEntities({ entities }: { entities: Array<Entity> }): Promise<void> {
        await this.#core._deleteEntities({ entity_uuids: entities.map(e => e.id!) });
        for (const entity of entities) {
            this.entity_registry.remove({ entity });
        }
    }

    /**
     * @internal
     */
    _onScriptEventReceived = async (e: Event) => {
        const event = (e as CustomEvent<ScriptEvent>).detail;

        if (event.emitter_rtid === 0n) {
            return;
        }

        const emitter = await this.getEntity({ entity_rtid: event.emitter_rtid });
        if (!emitter) {
            return;
        }

        const dataObject = event.data_object as { hEntity: { linkage: Array<UUID>; originalEUID: UUID } };
        const entity = await this.findEntity(Entity, { entity_uuid: dataObject.hEntity.originalEUID });

        if (!entity) {
            return;
        }

        switch (event.event_name) {
            case "7a8cc05e-8659-4b23-99d1-1352d13e2020/enter_trigger":
                emitter.onTriggerEntered({ entity });
                break;

            case "7a8cc05e-8659-4b23-99d1-1352d13e2020/exit_trigger":
                emitter.onTriggerExited({ entity });
                break;
        }
    };

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
        return this.#core._spawnEntity({ entity, options });
    }

    /**
     *
     */
    #addEditorEntities<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        { editor_entities }: { editor_entities: Array<EditorEntity> },
    ): Array<EntityType> {
        const entities = editor_entities
            .filter(editor_entity => this.entity_registry.get({ entity_rtid: BigInt(editor_entity.rtid) }) === null)
            .map(e => new Proxy(new entity_type(this).init(e), Entity.handler) as EntityType);

        for (const entity of entities) {
            this.entity_registry.add({ entity });
        }

        return entities;
    }

    /**
     * @internal
     */
    async _getChildren({ entity_rtid }: { entity_rtid: RTID }): Promise<Array<Entity>> {
        const editor_entities = await this.#core._getChildren({ entity_rtid });
        return this.#addEditorEntities(Entity, { editor_entities });
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
}

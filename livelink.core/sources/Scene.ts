import { EditorEntity, RTID, ScriptEvent, UUID } from "../_prebuild/types";
import { LivelinkCore } from "./LivelinkCore";
import { EntityRegistry } from "./EntityRegistry";
import { Entity } from "./Entity";

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
    getEntity({ entity_rtid }: { entity_rtid: RTID }): Entity | null {
        return this.entity_registry.get({ entity_rtid });
    }

    /**
     *
     */
    async newEntity<EntityType extends Entity>(
        entity_type: { new (_: Scene): EntityType },
        name: string,
    ): Promise<EntityType> {
        let entity = new entity_type(this).init(name);
        entity = new Proxy(entity, Entity.handler) as EntityType;
        entity.auto_update = "off";
        entity.onCreate();
        entity.auto_update = "on";
        await entity.instantiate();
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
        const editor_entities = await this.#core._findEntitiesByEUID({
            entity_uuid,
        });

        if (editor_entities.length === 0) {
            return null;
        }

        const entities = editor_entities.map(
            e => new Proxy(new entity_type(this).init(e), Entity.handler) as EntityType,
        );

        for (const entity of entities) {
            this.entity_registry.add({ entity });
        }

        return entities[0];
    }

    /**
     * @internal
     */
    _onScriptEventReceived = (e: Event) => {
        const event = (e as CustomEvent<ScriptEvent>).detail;

        const entity = this.getEntity({ entity_rtid: event.emitter_rtid });

        if (!entity) {
            return;
        }

        switch (event.event_name) {
            case "7a8cc05e-8659-4b23-99d1-1352d13e2020/enter_trigger":
                entity.onTriggerEntered();
                break;

            case "7a8cc05e-8659-4b23-99d1-1352d13e2020/exit_trigger":
                entity.onTriggerExited();
                break;
        }
    };

    /**
     * @internal
     */
    async _createEntity({ entity }: { entity: Entity }): Promise<EditorEntity> {
        return this.#core.createEntity({ entity });
    }
}

import type {
    RTID,
    UUID,
    ComponentSerializer,
    UpdateEntitiesFromJsonMessage,
    UpdateEntitiesCommand,
    ComponentType,
    RemoveComponentsCommand,
} from "@3dverse/livelink.core";
import { Entity } from "./Entity";

/**
 *
 */
export class EntityRegistry {
    /**
     *
     */
    #entities = new Set<Entity>();

    /**
     *
     */
    #entity_rtid_lut = new Map<RTID, Entity>();

    /**
     *
     */
    #entity_euid_lut = new Map<UUID, Array<Entity>>();

    /**
     *
     */
    #dirty_components = new Map<ComponentType, Set<Entity>>();
    #detached_components = new Map<ComponentType, Set<Entity>>();
    #dirty_components_to_broadcast = new Map<ComponentType, Set<Entity>>();

    /**
     *
     */
    #elapsed_time = 0;

    /**
     *
     */
    #serializer: ComponentSerializer | null = null;

    /**
     *
     */
    add({ entity }: { entity: Entity }): void {
        if (!entity.rtid || !entity.id) {
            throw new Error("Trying to add an entity without a EUID to the registry.");
        }

        const existingEntity = this.#entity_rtid_lut.get(entity.rtid);
        if (existingEntity) {
            throw new Error(
                `Cannot add entity ${entity.name} to the registry, because entity ${existingEntity.name} has the same RTID.`,
            );
        }

        this.#entities.add(entity);
        this.#entity_rtid_lut.set(entity.rtid, entity);
        const entities = this.#entity_euid_lut.get(entity.id);

        if (entities) {
            entities.push(entity);
        } else {
            this.#entity_euid_lut.set(entity.id, [entity]);
        }
    }

    /**
     *
     */
    remove({ entity }: { entity: Entity }): void {
        if (!entity.rtid || !entity.id) {
            throw new Error("Trying to remove an entity without a EUID from the registry.");
        }

        if (!this.#entity_rtid_lut.delete(entity.rtid)) {
            throw new Error(`Trying to remove entity ${entity.rtid} which has not been registred to the registry.`);
        }

        this.#entity_euid_lut.delete(entity.id);
        this.#entities.delete(entity);
    }

    /**
     *
     */
    get({ entity_rtid }: { entity_rtid: RTID }): Entity | null {
        return this.#entity_rtid_lut.get(entity_rtid) ?? null;
    }

    /**
     *
     */
    find({ entity_euid }: { entity_euid: UUID }): Array<Entity> {
        return this.#entity_euid_lut.get(entity_euid) ?? [];
    }

    /**
     * @internal
     */
    _configureComponentSerializer({ component_serializer }: { component_serializer: ComponentSerializer }) {
        this.#serializer = component_serializer;

        for (const component_name of this.#serializer.component_names) {
            this.#dirty_components.set(component_name, new Set<Entity>());
            this.#detached_components.set(component_name, new Set<Entity>());
            this.#dirty_components_to_broadcast.set(component_name, new Set<Entity>());
        }
    }

    /**
     *
     */
    advanceFrame({ dt }: { dt: number }) {
        for (const entity of this.#entities) {
            entity.onUpdate({ elapsed_time: this.#elapsed_time });
        }

        this.#elapsed_time += dt;
    }

    /**
     *
     */
    _updateEntityFromEvent({
        entity_euid,
        updated_components,
    }: {
        entity_euid: string;
        updated_components: Record<string, unknown>;
    }) {
        const entities = this.find({ entity_euid });

        if (entities.length === 0) {
            console.log("Received an update for an undiscovered entity", entity_euid);
            return;
        }

        for (const entity of entities) {
            entity._updateFromEvent({ updated_components });
        }
    }

    /**
     * @internal
     */
    _addEntityToUpdate({ component_type, entity }: { component_type: ComponentType; entity: Entity }) {
        const dirty_entities = this.#dirty_components.get(component_type);
        if (dirty_entities) {
            dirty_entities.add(entity);
        }
    }

    /**
     * @internal
     */
    _detachComponentFromEntity({ component_type, entity }: { component_type: ComponentType; entity: Entity }) {
        const detached_components = this.#detached_components.get(component_type);
        if (detached_components) {
            detached_components.add(entity);
        }
    }

    /**
     * @internal
     */
    _getEntitiesToUpdate(): UpdateEntitiesFromJsonMessage | null {
        const msg = { components: [] as Array<{ component_type: ComponentType; entities: Set<Entity> }> };

        for (const [component_type, entities] of this.#dirty_components) {
            if (entities.size !== 0) {
                msg.components.push({ component_type, entities });
            }
        }

        return msg.components.length > 0 ? msg : null;
    }

    /**
     * @internal
     */
    _getComponentsToDetach(): RemoveComponentsCommand | null {
        const msg = { components: [] as Array<{ component_type: ComponentType; entities: Set<Entity> }> };

        for (const [component_type, entities] of this.#detached_components) {
            if (entities.size !== 0) {
                msg.components.push({ component_type, entities });
            }
        }

        return msg.components.length > 0 ? msg : null;
    }

    /**
     * @internal
     */
    _getEntitiesToBroadcast(): UpdateEntitiesCommand | null {
        const msg: UpdateEntitiesCommand = {};
        let hasData = false;

        for (const [component_type, entities] of this.#dirty_components_to_broadcast) {
            for (const entity of entities) {
                msg[entity.id!] = msg[entity.id!] ?? {};
                //@ts-ignore
                msg[entity.id!][component_type] = entity[component_type];
                hasData = true;
            }
        }

        return hasData ? msg : null;
    }

    /**
     * @internal
     */
    _clearUpdateList() {
        for (const [component_type, entities] of this.#dirty_components) {
            const broadcast_set = this.#dirty_components_to_broadcast.get(component_type);
            for (const entity of entities) {
                if (entity.auto_broadcast === "on") {
                    broadcast_set!.add(entity);
                }
            }
            entities.clear();
        }
    }

    /**
     * @internal
     */
    _clearDetachList() {
        for (const [_, entities] of this.#detached_components) {
            entities.clear();
        }
    }

    /**
     * @internal
     */
    _clearBroadcastList() {
        for (const [_, entities] of this.#dirty_components_to_broadcast) {
            entities.clear();
        }
    }
}

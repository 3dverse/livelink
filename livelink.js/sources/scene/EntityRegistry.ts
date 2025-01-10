//------------------------------------------------------------------------------
import type { RTID, UUID, ComponentsRecord, ComponentName, UpdateEntityCommand } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Entity } from "./Entity";

/**
 * @internal
 *
 * The EntityRegistry class is responsible for managing the entities in the scene.
 * It keeps track of all entities and provides methods to add, remove, and find entities.
 * It also keeps track of:
 *  - dirty entities that have components that have been updated and need to be broadcasted to the editor.
 *  - entities that have components that have been detached and need to be removed from the editor.
 *  - entities that have updates that need to be broadcasted to the editor.
 */
export class EntityRegistry {
    /**
     * A set of all resolved entities that are ready to be used in the client application.
     */
    #entities = new Set<Entity>();

    /**
     * Map from rtid to entity.
     */
    #entity_rtid_lut = new Map<RTID, Entity>();

    /**
     * Map from EUID to a list of entities sharing the same EUID.
     */
    #entity_euid_lut = new Map<UUID, Array<Entity>>();

    /**
     * List of dirty entities sorted by component type.
     */
    #dirty_entities = new Set<Entity>();

    /**
     * List of dirty entities that need to be broadcasted to the editor sorted by component type.
     */
    #entities_to_persist = new Map<Entity, Set<ComponentName>>();

    /**
     * Adds a new entity in the registry. The entity must be valid, i.e. have valid RTID and EUID and must not have the
     * same RTID as any registered entity.
     *
     * @param entity The entity to add.
     * @throws Error if the entity is invalid or if an entity with the same RTID is already registered.
     */
    add({ entity }: { entity: Entity }): void {
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
     * Removes an entity from the registry. The entity must have been previously added to the registry.
     *
     * @param entity The entity to remove.
     * @throws Error if the entity is not registered in the registry.
     */
    remove({ entity }: { entity: Entity }): void {
        if (!this.#entity_rtid_lut.delete(entity.rtid)) {
            throw new Error(`Trying to remove entity ${entity.rtid} which has not been registred to the RTID LUT.`);
        }

        const entities = this.#entity_euid_lut.get(entity.id);
        if (!entities) {
            throw new Error(`Trying to remove entity ${entity.id} which has not been registered to the EUID LUT.`);
        }

        const index = entities.indexOf(entity);
        if (index == -1) {
            throw new Error(`Trying to remove entity ${entity.id} which has not been registered to the EUID LUT.`);
        }

        entities.slice(index, 1);

        if (entities.length === 0) {
            this.#entity_euid_lut.delete(entity.id);
        }

        if (!this.#entities.delete(entity)) {
            throw new Error(`Trying to remove entity ${entity.id} which has not been registered to the registry.`);
        }
    }

    /**
     * @internal
     *
     * Returns the entity with the given RTID or null if not found.
     *
     * @param entity_rtid The RTID of the entity to get.
     * @returns The entity with the given RTID or null if not found.
     */
    get({ entity_rtid }: { entity_rtid: RTID }): Entity | null {
        return this.#entity_rtid_lut.get(entity_rtid) ?? null;
    }

    /**
     * Returns all entities matching the given EUID or empty array if not found.
     *
     * @param entity_euid The EUID of the entities to get.
     * @returns All entities matching the given EUID or empty array if not found.
     */
    find({ entity_euid }: { entity_euid: UUID }): Array<Entity> {
        return this.#entity_euid_lut.get(entity_euid) ?? [];
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
        const entities = this.find({ entity_euid });

        if (entities.length === 0) {
            console.debug("Received an update for an undiscovered entity", entity_euid);
            return;
        }

        for (const entity of entities) {
            entity._mergeComponents({ components: updated_components, dispatch_event: true });
        }
    }

    /**
     * @internal
     */
    _addDirtyEntity({ entity }: { entity: Entity }): void {
        this.#dirty_entities.add(entity);
    }

    /**
     * @internal
     */
    _removeEntityFromBroadcastList({ entity }: { entity: Entity }): void {
        this.#entities_to_persist.delete(entity);
    }

    /**
     * @internal
     */
    _getEntitiesToUpdate(): Array<UpdateEntityCommand> {
        const update_command = new Array<UpdateEntityCommand>(this.#dirty_entities.size);

        let i = 0;
        for (const entity of this.#dirty_entities) {
            update_command[i++] = {
                entity_components: entity,
                dirty_components: entity._dirty_components,
                deleted_components: entity._deleted_components,
            };

            if (entity.auto_broadcast === "on") {
                this.#updateBroadcastList({ entity });
            }

            entity._clearDirtyState();
        }

        this.#dirty_entities.clear();

        return update_command;
    }

    /**
     * @internal
     */
    _getEntitiesToPersist(): Array<UpdateEntityCommand> {
        const update_command = new Array<UpdateEntityCommand>(this.#entities_to_persist.size);

        let i = 0;
        for (const [entity, component_names] of this.#entities_to_persist) {
            update_command[i++] = {
                entity_components: entity,
                dirty_components: Array.from(component_names),
                deleted_components: [],
            };
        }

        this.#entities_to_persist.clear();

        return update_command;
    }

    /**
     * @internal
     */
    #updateBroadcastList({ entity }: { entity: Entity }): void {
        const broadcast_data = this.#entities_to_persist.get(entity);
        if (!broadcast_data) {
            this.#entities_to_persist.set(entity, new Set([...entity._dirty_components]));
        } else {
            for (const component_name of entity._dirty_components) {
                broadcast_data.add(component_name);
            }
        }
    }
}

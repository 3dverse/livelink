import { ComponentDescriptor, UUID, UpdateEntitiesCommand, UpdateEntitiesFromJsonMessage } from "../_prebuild/types";
import type { RTID } from "./types/RTID";
import { Entity } from "./Entity";
import { ComponentSerializer } from "./ComponentSerializer";
import { ComponentType } from "../_prebuild/types/components";

/**
 *
 */
export class EntityRegistry {
    /**
     *
     */
    private _entities = new Set<Entity>();

    /**
     *
     */
    private _entity_rtid_lut = new Map<RTID, Entity>();

    /**
     *
     */
    private _entity_euid_lut = new Map<UUID, Array<Entity>>();

    /**
     *
     */
    private _dirty_entities = new Map<ComponentType, Set<Entity>>();
    private _dirty_entities_to_broadcast = new Map<ComponentType, Set<Entity>>();

    /**
     *
     */
    private _elapsed_time = 0;

    /**
     *
     */
    private _serializer: ComponentSerializer | null = null;

    /**
     *
     */
    add({ entity }: { entity: Entity }): void {
        if (!entity.rtid) {
            throw new Error("Trying to add an entity without a EUID to the registry.");
        }

        if (this._entity_rtid_lut.has(entity.rtid)) {
            throw new Error(
                `Cannot add entity ${entity.name} to the registry, because entity
        ${this._entity_rtid_lut.get(entity.rtid).name} has the same RTID.`,
            );
        }

        this._entities.add(entity);
        this._entity_rtid_lut.set(entity.rtid, entity);
        const entities = this._entity_euid_lut.get(entity.id);

        if (entities) {
            entities.push(entity);
        } else {
            this._entity_euid_lut.set(entity.id, [entity]);
        }
    }

    /**
     *
     */
    remove({ entity }: { entity: Entity }): void {
        if (!entity.rtid) {
            throw new Error("Trying to remove an entity without a EUID from the registry.");
        }

        if (!this._entity_rtid_lut.delete(entity.rtid)) {
            throw new Error(`Trying to remove entity ${entity.rtid} which has not been registred to the registry.`);
        }

        this._entity_euid_lut.delete(entity.id);
        this._entities.delete(entity);
    }

    /**
     *
     */
    get({ entity_rtid }: { entity_rtid: RTID }): Entity | null {
        return this._entity_rtid_lut.get(entity_rtid) ?? null;
    }

    /**
     *
     */
    find({ entity_euid }: { entity_euid: UUID }): Array<Entity> {
        return this._entity_euid_lut.get(entity_euid) ?? [];
    }

    /**
     * @internal
     */
    _configureComponentSerializer({
        component_descriptors,
    }: {
        component_descriptors: Record<string, ComponentDescriptor>;
    }) {
        this._serializer = new ComponentSerializer(component_descriptors);

        for (const component_name of this._serializer.component_names) {
            this._dirty_entities.set(component_name, new Set<Entity>());
            this._dirty_entities_to_broadcast.set(component_name, new Set<Entity>());
        }
    }

    /**
     *
     */
    advanceFrame({ dt }: { dt: number }) {
        for (const entity of this._entities) {
            entity.onUpdate({ elapsed_time: this._elapsed_time });
        }

        this._elapsed_time += dt;
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
        const dirty_entities = this._dirty_entities.get(component_type);
        if (dirty_entities) {
            dirty_entities.add(entity);
        }
    }

    /**
     * @internal
     */
    _getEntitiesToUpdate(): UpdateEntitiesFromJsonMessage | null {
        const msg = { components: [] };

        for (const [component_type, entities] of this._dirty_entities) {
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

        for (const [component_type, entities] of this._dirty_entities_to_broadcast) {
            for (const entity of entities) {
                msg[entity.id] = msg[entity.id] ?? {};
                msg[entity.id][component_type] = entity[component_type];
                hasData = true;
            }
        }

        return hasData ? msg : null;
    }

    /**
     * @internal
     */
    _clearUpdateList() {
        for (const [component_type, entities] of this._dirty_entities) {
            const broadcast_set = this._dirty_entities_to_broadcast.get(component_type);
            for (const entity of entities) {
                broadcast_set.add(entity);
            }
            entities.clear();
        }
    }

    /**
     * @internal
     */
    _clearBroadcastList() {
        for (const [_, entities] of this._dirty_entities_to_broadcast) {
            entities.clear();
        }
    }
}

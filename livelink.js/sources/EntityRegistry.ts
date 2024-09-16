import type {
    RTID,
    UUID,
    Serializer,
    UpdateEntitiesFromJsonMessage,
    ComponentType,
    RemoveComponentsCommand,
    UpdateComponentsCommand,
    UpdateEntitiesFromBytesMessage,
    ComponentSerializer,
} from "@3dverse/livelink.core";
import { Entity } from "./Entity";

/**
 * @internal
 */
export class EntityRegistry {
    /**
     * A set of all resolved entities.
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
     * List of dirty entities sorted by component.
     */
    #dirty_components = new Map<ComponentType, Set<Entity>>();

    /**
     * List of dirty entities having detached components sorted by component.
     */
    #detached_components = new Map<ComponentType, Set<Entity>>();

    /**
     *
     */
    #dirty_components_to_broadcast = new Map<ComponentType, Set<Entity>>();

    /**
     *
     */
    #elapsed_time = 0;

    /**
     *
     */
    #serializer: Serializer | null = null;

    /**
     * Adds a new entity in the registry. The entity must be valid, i.e. have valid RTID and EUID and must not have the
     * same RTID as any registered entity.
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
     * Removes an entity from the registry. The entity must have been previously added to the registry.
     */
    remove({ entity }: { entity: Entity }): void {
        if (!entity.rtid || !entity.id) {
            throw new Error("Trying to remove an entity without a EUID from the registry.");
        }

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
     * Returns the entity with the given RTID or null if not found.
     */
    get({ entity_rtid }: { entity_rtid: RTID }): Entity | null {
        return this.#entity_rtid_lut.get(entity_rtid) ?? null;
    }

    /**
     * Returns all entities matching the given EUID or empty array if not found.
     */
    find({ entity_euid }: { entity_euid: UUID }): Array<Entity> {
        return this.#entity_euid_lut.get(entity_euid) ?? [];
    }

    /**
     * @internal
     */
    _configureComponentSerializer({ serializer }: { serializer: Serializer }) {
        this.#serializer = serializer;

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
    _getEntitiesToUpdate():
        | {
              binary: true;
              message: UpdateEntitiesFromBytesMessage;
          }
        | {
              binary: false;
              message: UpdateEntitiesFromJsonMessage;
          }
        | null {
        let binary = true;
        const message = {
            components: [] as Array<{
                component_type: ComponentType;
                entities: Set<Entity>;
                component_serializer?: ComponentSerializer;
            }>,
        };

        for (const [component_type, entities] of this.#dirty_components) {
            if (entities.size !== 0) {
                const component_serializer = this.#serializer!.getComponentSerializer(component_type);
                if (!component_serializer) {
                    binary = false;
                }
                message.components.push({
                    component_type,
                    component_serializer,
                    entities,
                });
            }
        }

        return message.components.length > 0
            ? ({ binary, message } as
                  | {
                        binary: true;
                        message: UpdateEntitiesFromBytesMessage;
                    }
                  | {
                        binary: false;
                        message: UpdateEntitiesFromJsonMessage;
                    })
            : null;
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
    _getEntitiesToBroadcast(): UpdateComponentsCommand | null {
        const msg: UpdateComponentsCommand = {};
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

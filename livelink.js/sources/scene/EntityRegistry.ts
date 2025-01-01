//------------------------------------------------------------------------------
import type {
    RTID,
    UUID,
    UpdateComponentsCommand,
    ComponentDescriptor,
    ComponentsRecord,
    ComponentType,
    ComponentName,
} from "@3dverse/livelink.core";

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
    #dirty_components = new Map<ComponentName, Set<Entity>>();

    /**
     * List of dirty entities having detached components sorted by component type.
     */
    #detached_components = new Map<ComponentName, Set<Entity>>();

    /**
     * List of dirty entities that need to be broadcasted to the editor sorted by component type.
     */
    #dirty_components_to_broadcast = new Map<ComponentName, Set<Entity>>();

    /**
     * Default values for all component attributes.
     */
    #component_default_values = new Map<ComponentName, object>();

    /**
     *
     */
    constructor() {
        for (const component_name of Entity.component_names) {
            this.#dirty_components.set(component_name, new Set<Entity>());
            this.#detached_components.set(component_name, new Set<Entity>());
            this.#dirty_components_to_broadcast.set(component_name, new Set<Entity>());
        }
    }

    /**
     * Adds a new entity in the registry. The entity must be valid, i.e. have valid RTID and EUID and must not have the
     * same RTID as any registered entity.
     *
     * @param entity The entity to add.
     * @throws Error if the entity is invalid or if an entity with the same RTID is already registered.
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
     *
     * @param entity The entity to remove.
     * @throws Error if the entity is not registered in the registry.
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
     * Visits all entities in the registry and calls the given visitor function for each entity.
     */
    visitEntities({ visitor }: { visitor: (entity: Entity) => void }): void {
        for (const entity of this.#entities) {
            visitor(entity);
        }
    }

    /**
     * @internal
     * Configures the default values for all component attributes.
     *
     * @param component_descriptors The component descriptors to use.
     */
    _configureComponentDefaultValues({
        component_descriptors,
    }: {
        component_descriptors: Record<ComponentName, ComponentDescriptor>;
    }): void {
        for (const key in component_descriptors) {
            const component_name = key as ComponentName;
            const defaultValue = {} as Record<string, unknown>;
            const component_descriptor = component_descriptors[component_name];
            for (const attribute of component_descriptor.attributes) {
                if (attribute.mods?.indexOf("engine-only") > -1) {
                    continue;
                }

                if (attribute.default !== undefined) {
                    defaultValue[attribute.name] = attribute.default;
                } else {
                    defaultValue[attribute.name] = get_attribute_default_value(attribute.type);
                }
            }

            this.#component_default_values.set(component_name, defaultValue);
        }
    }

    /**
     * @internal
     */
    _getComponentDefaultValue({ component_type }: { component_type: ComponentName }): object {
        return this.#component_default_values.get(component_type) ?? {};
    }

    /**
     * @internal
     */
    _updateEntityFromEvent({
        entity_euid,
        updated_components,
    }: {
        entity_euid: string;
        updated_components: ComponentsRecord;
    }): void {
        const entities = this.find({ entity_euid });

        if (entities.length === 0) {
            console.log("Received an update for an undiscovered entity", entity_euid);
            return;
        }

        for (const entity of entities) {
            entity._setComponentsFromEditor({ components: updated_components });
        }
    }

    /**
     * @internal
     */
    _addEntityToUpdate({ component_type, entity }: { component_type: ComponentName; entity: Entity }): void {
        const dirty_entities = this.#dirty_components.get(component_type);
        if (dirty_entities) {
            dirty_entities.add(entity);
        }
    }

    /**
     * @internal
     */
    _detachComponentFromEntity({ component_type, entity }: { component_type: ComponentName; entity: Entity }): void {
        const detached_components = this.#detached_components.get(component_type);
        if (detached_components) {
            detached_components.add(entity);
        }
    }

    /**
     * @internal
     */
    _getEntitiesToUpdate(): Array<{
        component_type: ComponentName;
        entity_rtids: Array<RTID>;
        components: Array<ComponentType>;
    }> {
        const cmd: Array<{
            component_type: ComponentName;
            entity_rtids: Array<RTID>;
            components: Array<ComponentType>;
        }> = [];

        for (const [component_type, entities] of this.#dirty_components) {
            if (entities.size === 0) {
                continue;
            }

            const msg = {
                component_type,
                entity_rtids: new Array<RTID>(entities.size),
                components: new Array<ComponentType>(entities.size),
            };

            let i = 0;
            for (const entity of entities) {
                if (entity.rtid && entity[component_type]) {
                    msg.entity_rtids[i] = entity.rtid;
                    msg.components[i] = entity[component_type];
                    i++;
                }
            }

            cmd.push(msg);
        }

        return cmd;
    }

    /**
     * @internal
     */
    _getComponentsToDetach(): Array<{ component_type: ComponentName; entity_rtids: Array<RTID> }> {
        const cmd: Array<{ component_type: ComponentName; entity_rtids: Array<RTID> }> = [];

        for (const [component_type, entities] of this.#detached_components) {
            if (entities.size !== 0) {
                const msg = { component_type, entity_rtids: new Array<RTID>(entities.size) };
                let i = 0;
                for (const entity of entities) {
                    if (entity.rtid) {
                        msg.entity_rtids[i++] = entity.rtid;
                    }
                }
                if (i > 0) {
                    cmd.push(msg);
                }
            }
        }

        return cmd;
    }

    /**
     * @internal
     */
    _getEntitiesToBroadcast(): UpdateComponentsCommand | null {
        const msg: UpdateComponentsCommand = {};
        let hasData = false;

        for (const [component_type, entities] of this.#dirty_components_to_broadcast) {
            for (const entity of entities) {
                if (entity.id && entity[component_type]) {
                    msg[entity.id] = msg[entity.id] ?? {};
                    (msg[entity.id][component_type] as ComponentType) = entity[component_type];
                    hasData = true;
                }
            }
        }

        return hasData ? msg : null;
    }

    /**
     * @internal
     */
    _clearUpdateList(): void {
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
    _clearDetachList(): void {
        for (const [, entities] of this.#detached_components) {
            entities.clear();
        }
    }

    /**
     * @internal
     */
    _clearBroadcastList(): void {
        for (const [, entities] of this.#dirty_components_to_broadcast) {
            entities.clear();
        }
    }
}

/**
 * @internal
 */
const INVALID_UUID = "00000000-0000-0000-0000-000000000000" as const;

/**
 * @internal
 */
function get_attribute_default_value(type: string): unknown {
    if (type.startsWith("array")) {
        return [];
    }

    if (type.startsWith("map<")) {
        return {};
    }

    switch (type) {
        case "string":
            return "";
        case "json":
            return {};
        case "entity_ref":
            return { originalEUID: INVALID_UUID, linkage: [] };
        case "uuid":
            return INVALID_UUID;
        case "bool":
            return false;
        case "float":
            return 0;
    }

    if (type.endsWith("_ref")) {
        return INVALID_UUID;
    }

    if (type.includes("int")) {
        return 0;
    }

    const vectorMatch = type.match(/^i?vec([2-4])$/);
    if (vectorMatch) {
        return Array.from(Array(parseInt(vectorMatch[1]))).map(() => 0);
    }

    const matrixMatch = type.match(/^mat([2-4])$/);
    if (matrixMatch) {
        const matrixSize = parseInt(matrixMatch[1]);
        const elementCount = matrixSize * matrixSize;
        const result = Array.from(Array(elementCount)).map(() => 0);
        for (let i = 0; i < matrixSize; ++i) {
            result[i * matrixSize + i] = 1;
        }
        return result;
    }

    console.warn(`Unrecognized attribute type : ${type}`);
    return undefined;
}

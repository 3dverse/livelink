//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useRef, useState } from "react";

//------------------------------------------------------------------------------
import type {
    Entity,
    EntityCreationOptions,
    ComponentsManifest,
    FindEntityQuery,
    ComponentName,
    EntityUpdatedEvent,
    EntitiesCreatedEvent,
    EntitiesDeletedEvent,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * An new entity instance.
 *
 * @inline
 */
type NewEntities = {
    /**
     * The components to attach to the entities with their initial values.
     */
    components: Array<ComponentsManifest>;

    /**
     * The creation options of the entities.
     */
    options?: EntityCreationOptions & {
        /**
         * If true, the entities will be deleted when the component using the hook is unmounted.
         * Default is true.
         */
        delete_on_unmount?: boolean;
    };
};

/**
 * A provider of entities.
 */
export type EntitiesProvider = NewEntities | FindEntityQuery;

/**
 * A hook that provides entities and a flag indicating if the entities are pending loading.
 *
 * When the component is unmounted and if the entities were created using this hook,
 * the entities are deleted from the scene unless `delete_on_unmount` is set to false.
 *
 * @example
 * ```tsx
 * const { isPending, entities } = useEntities({ components: [{ name: "entity1" }, { name: "entity2" }] });
 * if (isPending) {
 *     return <div>Loading...</div>;
 * }
 * if (!entities.length) {
 *     return <div>Entities not found</div>;
 * }
 * return <div>Found {entities.length} entities</div>;
 * ```
 * @param entityProvider - The entity provider.
 * @returns The entities and a flag indicating if the entities are pending loading.
 *
 * @category Hooks
 */
export function useEntities(
    entityProvider: EntitiesProvider,
    watchedComponents: Array<ComponentName> | "any" = [],
): {
    isPending: boolean;
    entities: Array<Entity>;
} {
    const { instance } = useContext(LivelinkContext);

    const [entities, setEntities] = useState<Array<Entity>>([]);
    const [isPending, setIsPending] = useState(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const resolveEntitiesPromises = useRef<Map<string, Promise<Array<Entity>>>>(new Map());

    const propsHash = JSON.stringify(entityProvider);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntities = async (entityProvider: EntitiesProvider): Promise<Array<Entity>> => {
            if ("components" in entityProvider) {
                console.debug("---- Creating entities");
                return await instance.scene.newEntities({
                    components_array: entityProvider.components,
                    options: entityProvider.options,
                });
            } else if ("euid" in entityProvider) {
                return await instance.scene.findEntities({ entity_uuid: entityProvider.euid });
            } else if ("names" in entityProvider) {
                return await instance.scene.findEntitiesByNames({ entity_names: entityProvider.names });
            } else if ("mandatory_components" in entityProvider) {
                return await instance.scene.findEntitiesWithComponents({
                    mandatory_components: entityProvider.mandatory_components,
                    forbidden_components: entityProvider.forbidden_components,
                });
            }
            return [];
        };

        /**
         * To deal with React strict mode, and avoiding to create entities multiple times,
         * we need to keep track of the entities promises. The promises are stored
         * using the entity provider parameters as key.
         *
         * @returns The promise that resolves to the entities.
         */
        const getOrCreateResolveEntitiesPromise = (entityProvider: EntitiesProvider): Promise<Array<Entity>> => {
            const key = JSON.stringify(entityProvider);
            let promise = resolveEntitiesPromises.current.get(key);
            if (!promise) {
                promise = resolveEntities(entityProvider).then(instances => {
                    resolveEntitiesPromises.current.delete(key);
                    return instances;
                });
                resolveEntitiesPromises.current.set(key, promise);
            }

            // Now we have to potentially wait for other promises that are creating entities
            // to delete them, because they might conflict with the current one.
            // The risk is almost inexistent, but better be safe than sorry.
            const otherPromises = Array.from(resolveEntitiesPromises.current.entries()).filter(
                ([otherKey]) => otherKey !== key,
            );

            if (otherPromises.length > 0) {
                for (const [otherKey, otherPromise] of otherPromises) {
                    otherPromise.then(async otherEntities => {
                        const otherEntityProvider = JSON.parse(otherKey) as EntitiesProvider;
                        if (
                            otherEntities.length > 0 &&
                            entities.length > 0 &&
                            "components" in otherEntityProvider &&
                            otherEntityProvider.options?.delete_on_unmount !== false
                        ) {
                            console.debug(
                                "---- Deleting entities created by another promise to avoid conflicts",
                                otherEntities,
                            );
                            instance.scene.deleteEntities({ entities: otherEntities });
                        }
                        return entities;
                    });
                }
            }

            return promise;
        };

        getOrCreateResolveEntitiesPromise(entityProvider)
            .then(foundEntities => setEntities(foundEntities))
            .finally(() => setIsPending(false));

        return (): void => {
            setEntities([]);
            setIsPending(true);
        };
    }, [instance, propsHash]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        return (): void => {
            if (
                entities.length > 0 &&
                "components" in entityProvider &&
                entityProvider.options?.delete_on_unmount !== false
            ) {
                console.debug("---- Deleting entities");
                instance?.scene.deleteEntities({ entities });
            }
        };
    }, [instance, entities]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance || isPending || !("mandatory_components" in entityProvider)) {
            return;
        }

        const { mandatory_components, forbidden_components } = entityProvider;

        if (mandatory_components.length === 0 && !forbidden_components?.length) {
            return;
        }

        const checkEntityValidity = (entity: Entity): boolean => {
            if (mandatory_components) {
                for (const compName of mandatory_components) {
                    if (!entity[compName]) {
                        return false;
                    }
                }
            }
            if (forbidden_components) {
                for (const compName of forbidden_components) {
                    if (entity[compName]) {
                        return false;
                    }
                }
            }
            return true;
        };

        const onEntitiesCreated = (event: EntitiesCreatedEvent): void => {
            const validEntities = event.entities.filter(checkEntityValidity);
            setEntities(prevEntities => [...prevEntities, ...validEntities]);
        };

        const onEntitiesDeleted = (event: EntitiesDeletedEvent): void => {
            setEntities(prevEntities => prevEntities.filter(entity => !event.includes(entity)));
        };

        instance.scene.addEventListener("on-entities-created", onEntitiesCreated);
        instance.scene.addEventListener("on-entities-deleted", onEntitiesDeleted);

        return (): void => {
            instance.scene.removeEventListener("on-entities-created", onEntitiesCreated);
            instance.scene.removeEventListener("on-entities-deleted", onEntitiesDeleted);
        };
    }, [isPending, instance, propsHash]);

    useEffect(() => {
        const alwaysUpdate = watchedComponents === "any";
        const neverUpdate = watchedComponents.length === 0;

        if (!entities.length || neverUpdate) {
            return;
        }

        const triggerUpdate = alwaysUpdate
            ? forceUpdate
            : (event: EntityUpdatedEvent): void => {
                  if (event.isAnyComponentDirty({ components: watchedComponents })) {
                      forceUpdate();
                  }
              };

        for (const entity of entities) {
            entity.addEventListener("on-entity-updated", triggerUpdate);
            entity.addEventListener("on-entity-visibility-changed", forceUpdate);
        }

        return (): void => {
            for (const entity of entities) {
                entity.removeEventListener("on-entity-visibility-changed", forceUpdate);
                entity.removeEventListener("on-entity-updated", triggerUpdate);
            }
        };
    }, [entities, watchedComponents]);

    return { isPending, entities };
}

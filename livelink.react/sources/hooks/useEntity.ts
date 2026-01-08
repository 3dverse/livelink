//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useRef, useState } from "react";

//------------------------------------------------------------------------------
import {
    Entity,
    type EntityCreationOptions,
    type ComponentsManifest,
    type FindEntityQuery,
    type UUID,
    type ComponentName,
    type EntityUpdatedEvent,
    type EntitiesDeletedEvent,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * An new entity instance.
 *
 * @inline
 */
type NewEntity = {
    /**
     * The name of the entity.
     */
    name: string;

    /**
     * The components to attach to the entity with their initial values.
     */
    components: ComponentsManifest;

    /**
     * The creation options of the entity.
     */
    options: EntityCreationOptions & {
        /**
         * If true, the entity will be deleted when the component using the hook is unmounted.
         * Default is true.
         */
        delete_on_unmount?: boolean;
    };
};

/**
 * @inline
 */
type FindEntityQueryByNames = {
    /**
     * The names of the entities to find.
     */
    names: Array<string>;
};

/**
 * @inline
 */
type FindEntityQueryByName = {
    /**
     * The name of the entity to find.
     */
    name: string;
};

/**
 * A provider of an entity.
 */
export type EntityProvider =
    | NewEntity
    | FindEntityQueryByName
    | Exclude<FindEntityQuery, FindEntityQueryByNames>
    | Entity;

/**
 * A hook that provides an entity and a flag indicating if the entity is pending loading.
 *
 * When the component is unmounted and if the entity was created using this hook,
 * the entity is deleted from the scene unless `delete_on_unmount` is set to false.
 *
 * @example
 * ```tsx
 * const { isPending, entity } = useEntity({ euid: "00000000-0000-0000-0000-000000000000" });
 * if (isPending) {
 *     return <div>Loading...</div>;
 * }
 * if (!entity) {
 *     return <div>Entity not found</div>;
 * }
 * return <div>Entity found: {entity.name}</div>;
 * ```
 * @param entityProvider - The entity provider.
 * @returns The entity and a flag indicating if the entity is pending loading.
 *
 * @category Hooks
 */
export function useEntity(
    entityProvider: EntityProvider,
    watchedComponents: Array<ComponentName> | "any" = [],
): {
    isPending: boolean;
    entity: Entity | null;
} {
    const { instance } = useContext(LivelinkContext);

    const [entity, setEntity] = useState<Entity | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const resolveEntityPromises = useRef<Map<string, Promise<Entity | null>>>(new Map());

    const findEntityQuery = entityProvider as {
        euid?: UUID;
        linkage?: Array<UUID>;
        name?: string;
        mandatory_components?: Array<ComponentName>;
        forbidden_components?: Array<ComponentName>;
    };

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntity = async (entityProvider: EntityProvider): Promise<Entity | null> => {
            if ("components" in entityProvider) {
                console.debug("---- Creating entity");
                return await instance.scene.newEntity(entityProvider);
            } else if ("linkage" in findEntityQuery) {
                return await instance.scene.findEntity({
                    entity_uuid: findEntityQuery.euid!,
                    linkage: findEntityQuery.linkage,
                });
            } else if ("euid" in findEntityQuery) {
                return (await instance.scene.findEntities({ entity_uuid: findEntityQuery.euid! }))[0];
            } else if ("name" in findEntityQuery && findEntityQuery.name) {
                return (await instance.scene.findEntitiesByNames({ entity_names: [findEntityQuery.name] }))[0];
            } else if ("mandatory_components" in findEntityQuery) {
                return (
                    await instance.scene.findEntitiesWithComponents({
                        mandatory_components: findEntityQuery.mandatory_components!,
                        forbidden_components: findEntityQuery.forbidden_components,
                    })
                )[0];
            }
            return null;
        };

        /**
         * To deal with React strict mode, and avoiding to create an entity multiple times,
         * we need to keep track of the entity promises. The promises are stored
         * using the entity provider parameters as key.
         *
         * @returns The promise that resolves to the entity.
         */
        const getOrCreateResolveEntityPromise = (entityProvider: EntityProvider): Promise<Entity | null> => {
            const key = JSON.stringify(entityProvider);
            let promise = resolveEntityPromises.current.get(key);
            if (!promise) {
                promise = resolveEntity(entityProvider).then(instance => {
                    resolveEntityPromises.current.delete(key);
                    return instance;
                });
                resolveEntityPromises.current.set(key, promise);
            }

            // Now we have to potentially wait for other promises that are creating entities
            // to delete them, because they might conflict with the current one.
            // The risk is almost inexistent, but better be safe than sorry.
            const otherPromises = Array.from(resolveEntityPromises.current.entries()).filter(
                ([otherKey]) => otherKey !== key,
            );

            if (otherPromises.length > 0) {
                for (const [otherKey, otherPromise] of otherPromises) {
                    otherPromise.then(async otherEntity => {
                        const otherEntityProvider = JSON.parse(otherKey) as EntityProvider;
                        if (
                            otherEntity &&
                            entity &&
                            "components" in otherEntityProvider &&
                            otherEntityProvider.options.delete_on_unmount !== false
                        ) {
                            console.debug(
                                "---- Deleting entity created by another promise to avoid conflicts",
                                otherEntity,
                            );
                            instance.scene.deleteEntities({ entities: [otherEntity] });
                        }
                        return entity;
                    });
                }
            }

            return promise;
        };

        if (findEntityQuery instanceof Entity) {
            setEntity(findEntityQuery);
            setIsPending(false);
            return;
        }

        getOrCreateResolveEntityPromise(entityProvider)
            .then(foundEntity => setEntity(foundEntity))
            .finally(() => setIsPending(false));

        return (): void => {
            setEntity(null);
            setIsPending(true);
        };
    }, [instance, JSON.stringify(findEntityQuery)]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        return (): void => {
            if (entity && "components" in entityProvider && entityProvider.options.delete_on_unmount !== false) {
                console.debug("---- Deleting entity");
                instance?.scene.deleteEntities({ entities: [entity] });
            }
        };
    }, [instance, entity]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        const alwaysUpdate = watchedComponents === "any";
        const neverUpdate = watchedComponents.length === 0;

        if (!entity || neverUpdate) {
            return;
        }

        const triggerUpdate = alwaysUpdate
            ? forceUpdate
            : (event: EntityUpdatedEvent): void => {
                  if (event.isAnyComponentDirty({ components: watchedComponents })) {
                      forceUpdate();
                  }
              };

        entity.addEventListener("on-entity-updated", triggerUpdate);

        return (): void => {
            entity.removeEventListener("on-entity-updated", triggerUpdate);
        };
    }, [entity, watchedComponents]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!entity || !instance) {
            return;
        }

        const onEntitiesDeleted = (event: EntitiesDeletedEvent): void => {
            if (event.includes(entity)) {
                setEntity(null);
            }
        };

        instance.scene.addEventListener("on-entities-deleted", onEntitiesDeleted);

        return (): void => {
            instance.scene.removeEventListener("on-entities-deleted", onEntitiesDeleted);
        };
    }, [instance, entity]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!entity) {
            return;
        }

        entity.addEventListener("on-entity-visibility-changed", forceUpdate);
        return (): void => {
            entity.removeEventListener("on-entity-visibility-changed", forceUpdate);
        };
    }, [entity]);

    return { isPending, entity };
}

//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";

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
    options?: EntityCreationOptions;
};

/**
 * A provider of entities.
 */
export type EntitiesProvider = NewEntities | FindEntityQuery;

/**
 * A hook that provides an entity and a flag indicating if the entity is pending loading.
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

    const propsHash = JSON.stringify(entityProvider);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntity = async (): Promise<Array<Entity>> => {
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

        resolveEntity()
            .then(foundEntities => setEntities(foundEntities))
            .finally(() => setIsPending(false));

        return (): void => {
            setEntities([]);
            setIsPending(true);
        };
    }, [instance, propsHash]);

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

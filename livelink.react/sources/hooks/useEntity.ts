//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";

//------------------------------------------------------------------------------
import type {
    Entity,
    EntityCreationOptions,
    ComponentsManifest,
    FindEntityQuery,
    UUID,
    ComponentName,
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
    options: EntityCreationOptions;
};

/**
 * A provider of an entity.
 *
 * @inline
 */
type EntityProvider = NewEntity | FindEntityQuery;

/**
 * A hook that provides an entity and a flag indicating if the entity is pending loading.
 *
 * @example
 * ```tsx
 * const { isPending, entity } = useEntity({ id: "00000000-0000-0000-0000-000000000000" });
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
export function useEntity(entityProvider: EntityProvider & { forceUpdateOnEntityUpdate?: boolean }): {
    isPending: boolean;
    entity: Entity | null;
} {
    const { instance } = useContext(LivelinkContext);

    const [entity, setEntity] = useState<Entity | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const findEntityQuery = entityProvider as {
        euid?: UUID;
        linkage?: Array<UUID>;
        names?: Array<string>;
        mandatory_components?: Array<ComponentName>;
        forbidden_components?: Array<ComponentName>;
    };
    const forceUpdateOnEntityUpdate = entityProvider.forceUpdateOnEntityUpdate ?? false;

    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntity = async (): Promise<Entity | null> => {
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
            } else if ("names" in findEntityQuery) {
                return (await instance.scene.findEntitiesByNames({ entity_names: findEntityQuery.names! }))[0];
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

        resolveEntity()
            .then(foundEntity => {
                setEntity(foundEntity);
            })
            .finally(() => {
                setIsPending(false);
            });

        return (): void => {
            setEntity(null);
            setIsPending(true);
        };
    }, [
        instance,
        findEntityQuery.euid,
        findEntityQuery.linkage,
        findEntityQuery.names,
        findEntityQuery.mandatory_components,
        findEntityQuery.forbidden_components,
    ]);

    useEffect(() => {
        if (!entity || !forceUpdateOnEntityUpdate) {
            return;
        }

        entity.addEventListener("entity-updated", forceUpdate);

        return (): void => {
            entity.removeEventListener("entity-updated", forceUpdate);
        };
    }, [entity, forceUpdateOnEntityUpdate]);

    return { isPending, entity };
}

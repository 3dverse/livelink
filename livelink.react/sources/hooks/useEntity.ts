//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, EntityRef, EntityCreationOptions, PartialComponentsRecord } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { Livelink as LivelinkInstance } from "@3dverse/livelink";

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
    components: PartialComponentsRecord;

    /**
     * The creation options of the entity.
     */
    options: EntityCreationOptions;
};

/**
 * A function that finds an entity.
 *
 * @inline
 */
type EntityFinder = {
    /**
     * A callback that is called to find the entity.
     */
    finder: ({ instance }: { instance: LivelinkInstance }) => Promise<Entity | null>;
};

/**
 * A provider of an entity.
 *
 * @inline
 */
type EntityProvider = EntityRef | NewEntity | EntityFinder;

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

    const entityRef = entityProvider as EntityRef;
    const entityFinder = entityProvider as EntityFinder;
    const forceUpdateOnEntityUpdate = entityProvider.forceUpdateOnEntityUpdate ?? false;

    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntity = async () => {
            if ("originalEUID" in entityProvider) {
                console.debug("---- Finding entity with id", entityProvider.originalEUID);
                return await instance.scene.findEntity({
                    entity_uuid: entityProvider.originalEUID,
                    linkage: entityProvider.linkage,
                });
            } else if ("components" in entityProvider) {
                console.debug("---- Creating entity");
                return await instance.scene.newEntity(entityProvider);
            } else {
                return await entityProvider.finder({ instance });
            }
        };

        resolveEntity()
            .then(foundEntity => {
                setEntity(foundEntity);
            })
            .finally(() => {
                setIsPending(false);
            });

        return () => {
            setEntity(null);
            setIsPending(true);
        };
    }, [instance, entityRef.originalEUID, entityFinder.finder]);

    useEffect(() => {
        if (!entity || !forceUpdateOnEntityUpdate) {
            return;
        }

        entity.addEventListener("entity-updated", forceUpdate);

        return () => {
            entity.removeEventListener("entity-updated", forceUpdate);
        };
    }, [entity, forceUpdateOnEntityUpdate]);

    return { isPending, entity };
}

//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";
import { Livelink as LivelinkInstance, Entity, type UUID } from "@3dverse/livelink";

import { LivelinkContext } from "../components/core/Livelink";

//------------------------------------------------------------------------------
export type EntityId = { id: UUID };
export type EntityClass = { class: typeof Entity; name: string };
export type EntityFinder = {
    finder: ({ instance }: { instance: LivelinkInstance }) => Promise<Entity | null>;
};

export type EntityProvider = EntityId | EntityClass | EntityFinder;

//------------------------------------------------------------------------------
export function useEntity(entityProvider: EntityProvider) {
    const { instance } = useContext(LivelinkContext);
    const [entity, setEntity] = useState<Entity | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const entityId = entityProvider as EntityId;
    const entityClass = entityProvider as EntityClass;
    const entityFinder = entityProvider as EntityFinder;

    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntity = async () => {
            if ("id" in entityProvider) {
                console.debug("---- Finding entity with id", entityProvider.id);
                return await instance.scene.findEntity(Entity, { entity_uuid: entityProvider.id });
            } else if ("class" in entityProvider) {
                console.debug("---- Creating entity");
                return await instance.scene.newEntity(entityProvider.class, entityProvider.name);
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
    }, [instance, entityId.id, entityClass.class, entityClass.name, entityFinder.finder]);

    useEffect(() => {
        if (!entity) {
            return;
        }
        entity.addEventListener("entity-updated", forceUpdate);

        return () => {
            entity.removeEventListener("entity-updated", forceUpdate);
        };
    }, [entity]);

    return { isPending, entity };
}

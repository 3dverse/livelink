//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";
import { Entity, UUID } from "@3dverse/livelink";
import { LivelinkContext } from "../components/core/Livelink";

//------------------------------------------------------------------------------
export function useEntity({ entity_uuid }: { entity_uuid: UUID }): { isPending: boolean; entity: Entity | null } {
    const { instance } = useContext(LivelinkContext);
    const [entity, setEntity] = useState<Entity | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        instance?.scene
            .findEntity(Entity, { entity_uuid })
            .then(foundEntity => {
                if (foundEntity) {
                    foundEntity.addEventListener("entity-updated", () => {
                        forceUpdate();
                    });
                }
                setEntity(foundEntity);
            })
            .finally(() => {
                setIsPending(false);
            });

        return () => setEntity(null);
    }, [instance]);

    return { isPending, entity };
}

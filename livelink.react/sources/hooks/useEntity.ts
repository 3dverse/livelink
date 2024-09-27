//------------------------------------------------------------------------------
import { useEffect, useReducer, useState } from "react";
import { Entity, Livelink, UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export function useEntity({ instance, entity_uuid }: { instance: Livelink | null; entity_uuid: UUID }): Entity | null {
    const [entity, setEntity] = useState<Entity | null>(null);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        if (instance) {
            (async function () {
                const ent = await instance.scene.findEntity(Entity, { entity_uuid });
                if (ent) {
                    ent.addEventListener("entity-updated", () => {
                        forceUpdate();
                    });
                }
                setEntity(ent);
            })();
        }

        return () => setEntity(null);
    }, [instance]);

    return entity;
}

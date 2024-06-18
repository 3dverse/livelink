//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Entity, Livelink, UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export function useEntity({ instance, entity_uuid }: { instance: Livelink | null; entity_uuid: UUID }): Entity | null {
    const [entity, setEntity] = useState<Entity | null>(null);

    useEffect(() => {
        if (instance) {
            (async function () {
                const ent = await instance.scene.findEntity(Entity, { entity_uuid });
                if (ent) {
                    ent.addEventListener("entity-updated", () => {
                        setEntity(null);
                        setTimeout(() => setEntity(ent), 0);
                    });
                }
                setEntity(ent);
            })();
        }

        return () => setEntity(null);
    }, [instance]);

    return entity;
}

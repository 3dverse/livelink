//------------------------------------------------------------------------------
import { Entity, Livelink, UUID } from "livelink.js";
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
export type Manifest = Record<string, UUID>;
//------------------------------------------------------------------------------
export async function findSmartObject(instance: Livelink, manifest: Manifest, objectName: string) {
    if (!(objectName in manifest)) {
        throw new Error(`Unknown SmartObject ${objectName}`);
    }

    if (!instance) {
        return { isLoading: true, entity: null };
    }

    const entity = await instance.findEntity(Entity, {
        entity_uuid: manifest[objectName],
    });

    return { isLoading: false, entity };
}

//------------------------------------------------------------------------------
export function useSmartObject({
    instance,
    manifest,
    smart_object,
}: {
    instance: Livelink | null;
    manifest: Manifest;
    smart_object: string;
}): Entity | null {
    const [entity, setEntity] = useState<Entity | null>(null);

    useEffect(() => {
        async function findAsync(inst: Livelink) {
            const { entity: e } = await findSmartObject(inst, manifest, smart_object);
            if (e) {
                e.addEventListener("entity-updated", () => {
                    setEntity(null);
                    setTimeout(() => setEntity(e), 0);
                });
            }
            setEntity(e);
        }

        if (instance) {
            findAsync(instance);
        }

        return () => setEntity(null);
    }, [instance, manifest, smart_object]);

    return entity;
}

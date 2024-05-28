//------------------------------------------------------------------------------
import { useState } from "react";
import * as Livelink from "livelink.js";

//------------------------------------------------------------------------------
export type Manifest = Record<string, Livelink.UUID>;
//------------------------------------------------------------------------------
export async function findSmartObject(instance: Livelink.Livelink, manifest: Manifest, objectName: string) {
    if (!(objectName in manifest)) {
        throw new Error(`Unknown SmartObject ${objectName}`);
    }

    if (!instance) {
        return { isLoading: true, entity: null };
    }

    const entity = await instance.findEntity(Livelink.Entity, {
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
    instance: Livelink.Livelink | null;
    manifest: Manifest;
    smart_object: string;
}): Livelink.Entity | null {
    const [entity, setEntity] = useState<Livelink.Entity | null>(null);

    async function find(instance: Livelink.Livelink) {
        if (entity) return entity;
        const { entity: e } = await findSmartObject(instance, manifest, smart_object);
        if (e) {
            e.__self.addEventListener("entity-updated", () => {
                setEntity(null);
                setTimeout(() => setEntity(e), 0);
            });
        }
        setEntity(e);
    }

    if (instance) {
        find(instance);
    }

    return entity;
}

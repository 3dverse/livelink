//------------------------------------------------------------------------------
import { useState } from "react";
import * as LiveLink from "livelink.js";

//------------------------------------------------------------------------------
export type Manifest = Record<string, LiveLink.UUID>;
//------------------------------------------------------------------------------
export async function findSmartObject(instance: LiveLink.LiveLink, manifest: Manifest, objectName: string) {
    if (!(objectName in manifest)) {
        throw new Error(`Unknown SmartObject ${objectName}`);
    }

    if (!instance) {
        return { isLoading: true, entity: null };
    }

    const entity = await instance.findEntity(LiveLink.Entity, {
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
    instance: LiveLink.LiveLink | null;
    manifest: Manifest;
    smart_object: string;
}): LiveLink.Entity | null {
    const [entity, setEntity] = useState<LiveLink.Entity | null>(null);

    async function find(instance: LiveLink.LiveLink) {
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

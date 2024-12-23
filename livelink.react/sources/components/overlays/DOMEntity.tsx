//------------------------------------------------------------------------------
import React, { PropsWithChildren, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Components, Entity, Vec2i, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { DOM3DElement } from "./DOM3DElement";

/**
 * A component that renders a DOM element at the position of an entity.
 *
 * @category Components
 */
export function DOMEntity({
    entity,
    scaleFactor,
    children,
}: PropsWithChildren<{
    entity: Entity | null;
    scaleFactor?: number;
}>) {
    const [worldPosition, setWorldPosition] = useState<Vec3>([0, 0, 0]);

    useEffect(() => {
        if (!entity) {
            return;
        }

        if (!entity.local_transform) {
            console.error("Entity does not have a local transform component.");
            return;
        }

        const updatePosition = () => {
            const local_transform = entity.local_transform as Required<Components.LocalTransform>;
            setWorldPosition(local_transform.position);
        };

        entity.addEventListener("entity-updated", updatePosition);
        return () => {
            entity.removeEventListener("entity-updated", updatePosition);
        };
    }, [entity]);

    return (
        <DOM3DElement worldPosition={worldPosition} scaleFactor={scaleFactor}>
            {children}
        </DOM3DElement>
    );
}

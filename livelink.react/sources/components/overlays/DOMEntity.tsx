import React, { useEffect, useState } from "react";
import { DOM3DElement } from "./DOM3DElement";
import type { Components, Entity, Vec2i, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export function DOMEntity({
    entity,
    pixel_dimensions,
    scale_factor,
    children,
}: React.PropsWithChildren<{
    entity: Entity | null;
    pixel_dimensions: Vec2i;
    scale_factor?: number;
}>) {
    const [world_position, setWorldPosition] = useState<Vec3>([0, 0, 0]);

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
        <DOM3DElement world_position={world_position} pixel_dimensions={pixel_dimensions} scale_factor={scale_factor}>
            {children}
        </DOM3DElement>
    );
}

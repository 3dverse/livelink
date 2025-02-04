//------------------------------------------------------------------------------
import React, { JSX, PropsWithChildren, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";

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
}>): JSX.Element {
    const [worldPosition, setWorldPosition] = useState<Vec3>([0, 0, 0]);

    useEffect(() => {
        if (!entity) {
            return;
        }

        const updatePosition = (): void => setWorldPosition(entity.global_transform.position);

        // Initialize the position
        updatePosition();

        entity.addEventListener("on-entity-updated", updatePosition);
        return (): void => {
            entity.removeEventListener("on-entity-updated", updatePosition);
        };
    }, [entity]);

    return (
        <DOM3DElement worldPosition={worldPosition} scaleFactor={scaleFactor}>
            {children}
        </DOM3DElement>
    );
}

//------------------------------------------------------------------------------
import React, { JSX, PropsWithChildren, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { DOM3DElement } from "./DOM3DElement";
import { Anchor } from "../../overlays/React3DElement";

/**
 * A component that renders a DOM element at the position of an entity.
 *
 * @category Components
 */
export function DOMEntity({
    entity,
    scaleFactor,
    anchor,
    children,
}: PropsWithChildren<{
    entity: Entity | null;
    anchor?: Anchor;
    scaleFactor?: number;
}>): JSX.Element | null {
    const [worldPosition, setWorldPosition] = useState<Vec3>(entity ? entity.global_transform.position : [0, 0, 0]);
    const [isVisible, setIsVisible] = useState(entity ? entity.is_visible : false);

    useEffect(() => {
        if (!entity) {
            return;
        }

        const updatePosition = (): void => setWorldPosition(entity.global_transform.position);
        const updateVisibility = (): void => setIsVisible(entity.is_visible);

        // Initialize states
        updatePosition();
        updateVisibility();

        entity.addEventListener("on-entity-updated", updatePosition);
        entity.addEventListener("on-entity-visibility-changed", updateVisibility);
        return (): void => {
            entity.removeEventListener("on-entity-updated", updatePosition);
            entity.removeEventListener("on-entity-visibility-changed", updateVisibility);
        };
    }, [entity]);

    if (!entity || !isVisible) {
        return null;
    }

    return (
        <DOM3DElement worldPosition={worldPosition} anchor={anchor} scaleFactor={scaleFactor}>
            {children}
        </DOM3DElement>
    );
}

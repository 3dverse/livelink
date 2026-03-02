//------------------------------------------------------------------------------
import React, { JSX, PropsWithChildren, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { AnchorOffset, DOM3DAnchor } from "./DOM3DAnchor";

/**
 * @deprecated Use `DOM3DEntityAnchor` instead.
 */
export function DOMEntity({
    children,
    ...props
}: PropsWithChildren<{
    entity: Entity | null;
    anchor?: AnchorOffset;
    scaleFactor?: number;
}>): JSX.Element | null {
    return (
        <DOM3DEntityAnchor offset={props.anchor} {...props}>
            {children}
        </DOM3DEntityAnchor>
    );
}

/**
 * A component that renders a <div> anchored to the position of an entity in world space.
 *
 * @category Components
 */
export function DOM3DEntityAnchor({
    entity,
    scaleFactor,
    offset,
    children,
}: PropsWithChildren<{
    entity: Entity | null;
    offset?: AnchorOffset;
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
        <DOM3DAnchor worldPosition={worldPosition} offset={offset} scaleFactor={scaleFactor}>
            {children}
        </DOM3DAnchor>
    );
}

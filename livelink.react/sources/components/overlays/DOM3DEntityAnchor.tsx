//------------------------------------------------------------------------------
import React, { JSX, PropsWithChildren, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { AnchorOffset, DOM3DAnchor } from "./DOM3DAnchor";
import { PointProjection } from "../../overlays/DOM3DElementProjection";

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
 * A component that renders a div anchored to the position of an entity in world space.
 *
 * @category Components
 */
export function DOM3DEntityAnchor({
    entity,
    scaleFactor,
    offset,
    onProjectionChange,
    children,
}: PropsWithChildren<{
    entity: Entity | null;
    offset?: AnchorOffset;
    scaleFactor?: number;
    onProjectionChange?: (projection: Readonly<PointProjection>) => void;
}>): JSX.Element | null {
    const [worldPosition, setWorldPosition] = useState<Vec3>(
        entity ? ([...entity.global_transform.position] as Vec3) : [0, 0, 0],
    );
    const [isVisible, setIsVisible] = useState(entity ? entity.is_visible : false);

    useEffect(() => {
        if (!entity) {
            return;
        }

        // Cloned: the array reference never changes (mutated in place), so React would bail out.
        const updatePosition = (): void => setWorldPosition([...entity.global_transform.position] as Vec3);
        const updateVisibility = (): void => setIsVisible(entity.is_visible);

        updatePosition();
        updateVisibility();

        // global_transform depends on every ancestor's transform too.
        const abortController = new AbortController();
        for (let node: Entity | null = entity; node; node = node.parent) {
            node.addEventListener("on-entity-updated", updatePosition, { signal: abortController.signal });
        }
        entity.addEventListener("on-entity-visibility-changed", updateVisibility, {
            signal: abortController.signal,
        });
        return (): void => {
            abortController.abort();
        };
    }, [entity]);

    if (!entity || !isVisible) {
        return null;
    }

    return (
        <DOM3DAnchor
            worldPosition={worldPosition}
            offset={offset}
            scaleFactor={scaleFactor}
            onProjectionChange={onProjectionChange}
        >
            {children}
        </DOM3DAnchor>
    );
}

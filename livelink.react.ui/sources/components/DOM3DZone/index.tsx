//------------------------------------------------------------------------------
import React, { lazy, Suspense } from "react";

//------------------------------------------------------------------------------
import type { EntityZonesProps } from "./entityZoneOptions";

//------------------------------------------------------------------------------
const EntityZonesLayer = lazy(() => import("./EntityZonesLayer"));

//------------------------------------------------------------------------------
/**
 * Zones drawn round entities in three.js, over the stream — see README.md. Mount it inside a
 * `Viewport`, as a use case's `viewport` slot is. three.js loads with it, not with the viewer.
 */
export function EntityZones(props: EntityZonesProps) {
    return (
        <Suspense fallback={null}>
            <EntityZonesLayer {...props} />
        </Suspense>
    );
}

//------------------------------------------------------------------------------
export type { EntityZoneColors, EntityZoneOptions, EntityZonePart, EntityZonesProps } from "./entityZoneOptions";

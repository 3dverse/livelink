//------------------------------------------------------------------------------
import React, { lazy, Suspense } from "react";

//------------------------------------------------------------------------------
import type { EntityZonesProps } from "./entityZoneOptions";

//------------------------------------------------------------------------------
const EntityZonesLayer = lazy(() => import("./EntityZonesLayer"));

//------------------------------------------------------------------------------
/**
 * Zones drawn round entities in three.js, over the stream — see README.md. Mount it inside a
 * `Viewport`. three.js loads with it, not with the rest of the package.
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

//------------------------------------------------------------------------------
// What an entity zone is asked to be: see `EntityZones`. No three.js here, so that zones can be
// described without loading it.
//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
/** The parts of a zone that can be left out. */
export type EntityZonePart = "ticks" | "dashedRing" | "sweep" | "curtain";

/**
 * Any CSS colour, a design token's `var()` included: resolved in the app's theme, and again when it
 * changes.
 */
export type EntityZoneColors = {
    /** The pad's glass, as opaque as its alpha: clear by default. */
    glass: string;
    /** Its rim, ticks and rings, and the light rising off it. */
    edge: string;
    /** The sweep turning with the entity. */
    sweep: string;
};

//------------------------------------------------------------------------------
export type EntityZoneOptions = {
    /** What the zone stands round: laid at its origin, it follows it. None yet, no zone. */
    entity: Entity | null;
    /** The pad's radius, in meters. */
    radiusM: number;
    /** How high the light rises off the pad's rim, in meters. */
    curtainHeightM?: number;
    /**
     * The entity's bounding box, in its own frame and in meters: whatever of the zone it stands in front
     * of fades out, as the entity would hide it — the stream hands the zone no depth. Without it, the
     * zone is drawn whole, over the entity too.
     */
    occluder?: { min: Vec3; max: Vec3 };
    /**
     * How wide that fade is about the box's outline, as an angle seen from the camera: the same few
     * pixels near or far. Wider, softer.
     */
    occlusionSoftnessRad?: number;
    /**
     * Which way the sweep's trail runs: behind it as the entity turns, 1 counter-clockwise seen from
     * above, -1 clockwise. Unset, it is taken from how the entity turns, once it does — counter-clockwise
     * till then.
     */
    turnDirection?: 1 | -1;
    colors?: Partial<EntityZoneColors>;
    /** Parts to leave out, as `false`: every part is drawn by default. */
    show?: Partial<Record<EntityZonePart, boolean>>;
};

/** A zone with every option set: what the zone is built from. */
export type ResolvedEntityZoneOptions = Required<
    Omit<EntityZoneOptions, "occluder" | "turnDirection" | "colors" | "show">
> & {
    entity: Entity;
    occluder: EntityZoneOptions["occluder"];
    turnDirection: EntityZoneOptions["turnDirection"];
    colors: EntityZoneColors;
    show: Record<EntityZonePart, boolean>;
};

//------------------------------------------------------------------------------
export type EntityZonesProps = {
    /**
     * One zone per entry, all on one canvas. Memoized, as an effect's dependency is: a new array
     * rebuilds every zone.
     */
    zones: EntityZoneOptions[];
    /**
     * Whether the zones show: they fade in and grow out from their entity's feet as they first show and
     * as it turns true, and fade out and shrink back as it turns false. Rebuilds nothing. True by default.
     */
    visible?: boolean;
};

//------------------------------------------------------------------------------
export const ENTITY_ZONE_DEFAULTS = {
    curtainHeightM: 0.7,
    occlusionSoftnessRad: 0.03,
    colors: {
        glass: "transparent",
        edge: "var(--3dverse-color-content-informative)",
        sweep: "var(--3dverse-color-brand)",
    },
    show: { ticks: true, dashedRing: true, sweep: true, curtain: true },
} satisfies Omit<ResolvedEntityZoneOptions, "entity" | "radiusM" | "occluder" | "turnDirection">;

//------------------------------------------------------------------------------
/** `options` with the defaults filled in: null while it has no entity, which draws no zone. */
export function resolveEntityZoneOptions(options: EntityZoneOptions): ResolvedEntityZoneOptions | null {
    const { entity } = options;
    if (!entity) {
        return null;
    }
    return {
        ...options,
        entity,
        curtainHeightM: options.curtainHeightM ?? ENTITY_ZONE_DEFAULTS.curtainHeightM,
        occlusionSoftnessRad: options.occlusionSoftnessRad ?? ENTITY_ZONE_DEFAULTS.occlusionSoftnessRad,
        occluder: options.occluder,
        turnDirection: options.turnDirection,
        colors: { ...ENTITY_ZONE_DEFAULTS.colors, ...options.colors },
        show: { ...ENTITY_ZONE_DEFAULTS.show, ...options.show },
    };
}

//------------------------------------------------------------------------------
/**
 * How acceptable an angle is: "acceptable", "conditional", acceptable for a limited time, or "notAcceptable".
 */
export type AngleZoneLevel = "acceptable" | "conditional" | "notAcceptable";

/**
 * Level an angle is shown at: its zone's, or "neutral", in grey, without zones.
 * @internal
 */
export type ShownLevel = AngleZoneLevel | "neutral";

/**
 * Range of angles, in degrees, from `min` included to `max` excluded, and how acceptable it is.
 */
export type AngleZone = {
    min: number;
    max: number;
    level: AngleZoneLevel;
};

//------------------------------------------------------------------------------
export const ANGLE_ZONE_LEVEL_LABELS: Record<AngleZoneLevel, string> = {
    acceptable: "Acceptable",
    conditional: "Conditionally acceptable",
    notAcceptable: "Not acceptable",
};

/** @internal */
export const ANGLE_ZONE_LEVEL_RANKS: Record<AngleZoneLevel, number> = {
    acceptable: 0,
    conditional: 1,
    notAcceptable: 2,
};

//------------------------------------------------------------------------------
/**
 * Index of the zone `angleDeg` is in. `zones` must be sorted and contiguous: angles outside of them belong to the
 * first or the last one.
 */
export function findZoneIndex(angleDeg: number, zones: ReadonlyArray<AngleZone>): number {
    const index = zones.findIndex(zone => angleDeg >= zone.min && angleDeg < zone.max);
    if (index >= 0) {
        return index;
    }
    return angleDeg < (zones[0]?.min ?? 0) ? 0 : Math.max(0, zones.length - 1);
}

/**
 * Part of a range of angles within one zone.
 * @internal
 */
export type ZoneSpan = {
    from: number;
    to: number;
    level: AngleZoneLevel;
};

/**
 * Range from `fromDeg` to `toDeg`, either way, cut where it crosses from one zone into the next: its parts in order
 * from `fromDeg`, each with the level of its zone, the last one ending at `toDeg`.
 * @internal
 */
export function splitByZone(fromDeg: number, toDeg: number, zones: ReadonlyArray<AngleZone>): Array<ZoneSpan> {
    const edges = [
        Math.min(fromDeg, toDeg),
        ...zoneBoundaries(zones, [Math.min(fromDeg, toDeg), Math.max(fromDeg, toDeg)]),
        Math.max(fromDeg, toDeg),
    ];
    if (toDeg < fromDeg) {
        edges.reverse();
    }
    return edges.slice(1).map((to, index) => {
        const from = edges[index]!;
        return { from, to, level: zones[findZoneIndex((from + to) / 2, zones)]!.level };
    });
}

/** Angles, within `[min, max]`, where one zone ends and the next starts. */
export function zoneBoundaries(zones: ReadonlyArray<AngleZone>, [min, max]: readonly [number, number]): Array<number> {
    return zones
        .slice(1)
        .map(zone => zone.min)
        .filter(angleDeg => angleDeg > min && angleDeg < max);
}

//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import { ANGLE_ZONE_LEVEL_RANKS, findZoneIndex, type AngleZone, type AngleZoneLevel } from "./zones";

//------------------------------------------------------------------------------
/**
 * - "ok": the angle is in an acceptable zone.
 * - "warning": the angle is in a zone that isn't acceptable, for less than its hold limit so far.
 * - "alert": the angle has stayed in a zone that isn't acceptable for longer than its hold limit.
 */
export type AngleExposureStatus = "ok" | "warning" | "alert";

/** Seconds the angle can stay continuously at each level, or worse, before the alert. */
export type AngleHoldLimits = Partial<Record<Exclude<AngleZoneLevel, "acceptable">, number>>;

export type AngleExposureAlert = {
    level: AngleZoneLevel;
    angleDeg: number;
    holdS: number;
    holdLimitS: number;
};

export type AngleExposure = {
    zone: AngleZone;
    level: AngleZoneLevel;
    status: AngleExposureStatus;
    /** Seconds the angle has continuously been at the current level, or worse. 0 when acceptable. */
    holdS: number;
    /** Hold limit of the current level, in seconds, or null when it has none. */
    holdLimitS: number | null;
    /** Times the angle left the acceptable zones over the last `frequencyWindowS`, per minute. */
    excursionsPerMinute: number;
    /** Times the angle left the acceptable zones since mounted. */
    excursionCount: number;
    /** Alerts since mounted. */
    alertCount: number;
    /** Seconds spent at each level since mounted. */
    timeByLevelS: Record<AngleZoneLevel, number>;
};

export type UseAngleExposureOptions = {
    /** Current angle, in degrees. */
    angleDeg: number;

    /** Zones of acceptability of the angle, sorted and contiguous. */
    zones: ReadonlyArray<AngleZone>;

    /** Defaults to `DEFAULT_HOLD_LIMITS`. */
    holdLimits?: AngleHoldLimits;

    /**
     * Degrees the angle has to go past a zone boundary by to change zone, so that an angle hovering around a
     * boundary, or the noise of the measurement, doesn't switch zones at every frame. Defaults to 2.
     */
    hysteresisDeg?: number;

    /** Seconds over which `excursionsPerMinute` is measured. Defaults to 60. */
    frequencyWindowS?: number;

    /** Called once each time the angle stays in a zone that isn't acceptable for longer than its hold limit. */
    onAlert?: (alert: AngleExposureAlert) => void;
};

//------------------------------------------------------------------------------
/**
 * The alert is raised as soon as the angle isn't acceptable, and never in a conditionally acceptable zone, which
 * only warns. Set the limits of the use case instead, e.g. the 4 s after which a posture counts as static.
 */
export const DEFAULT_HOLD_LIMITS: AngleHoldLimits = { notAcceptable: 0 };

const DEFAULT_HYSTERESIS_DEG = 2;
const DEFAULT_FREQUENCY_WINDOW_S = 60;
/** Period at which the timers are updated. */
const TICK_MS = 100;

const LEVELS = Object.keys(ANGLE_ZONE_LEVEL_RANKS) as Array<AngleZoneLevel>;

/**
 * Measures the exposure to an angle, e.g. the angle of a robot joint or the inclination of the trunk of a worker,
 * against zones of acceptability: which zone it is in, for how long it has been held there, how often it leaves the
 * acceptable zones, and whether a hold limit is exceeded.
 *
 * Its result is meant to be passed to `DOM3DAngle`, and to the rest of the interface, e.g. a panel listing
 * the alerts of the day.
 *
 * @category Hooks
 */
export function useAngleExposure({
    angleDeg,
    zones,
    holdLimits = DEFAULT_HOLD_LIMITS,
    hysteresisDeg = DEFAULT_HYSTERESIS_DEG,
    frequencyWindowS = DEFAULT_FREQUENCY_WINDOW_S,
    onAlert,
}: UseAngleExposureOptions): AngleExposure {
    const zoneIndex = useZoneIndex(angleDeg, zones, hysteresisDeg);
    const zone = zones[zoneIndex]!;
    const level = zone.level;

    const trackerRef = useRef<Tracker | null>(null);
    trackerRef.current ??= createTracker(level, performance.now());
    const tracker = trackerRef.current;

    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        const time = performance.now();
        updateTracker(trackerRef.current!, level, time);
        setNow(time);
    }, [level]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            const time = performance.now();
            const tracker = trackerRef.current!;
            tracker.excursions = tracker.excursions.filter(excursionTime => time - excursionTime <= MAX_WINDOW_MS);
            setNow(time);
        }, TICK_MS);
        return (): void => window.clearInterval(intervalId);
    }, []);

    // Until the effect above runs, the tracker is still at the previous level.
    const isTracked = tracker.level === level;
    const holdSince = level !== "acceptable" && isTracked ? tracker.holdSince[level] : null;
    const holdS = holdSince !== null ? Math.max(0, now - holdSince) / 1000 : 0;
    const holdLimitS = level !== "acceptable" ? (holdLimits[level] ?? null) : null;
    const status: AngleExposureStatus =
        level === "acceptable" ? "ok" : holdLimitS !== null && holdS >= holdLimitS ? "alert" : "warning";

    const windowMs = Math.min(frequencyWindowS * 1000, MAX_WINDOW_MS);
    const recentExcursions = tracker.excursions.filter(excursionTime => now - excursionTime <= windowMs).length;

    const timeByLevelS = Object.fromEntries(
        LEVELS.map(timeLevel => {
            const ongoingMs = timeLevel === tracker.level ? Math.max(0, now - tracker.levelSince) : 0;
            return [timeLevel, (tracker.timeByLevelMs[timeLevel] + ongoingMs) / 1000];
        }),
    ) as Record<AngleZoneLevel, number>;

    const alertCount = useAlerts({ status, alert: { level, angleDeg, holdS, holdLimitS: holdLimitS ?? 0 }, onAlert });

    return {
        zone,
        level,
        status,
        holdS,
        holdLimitS,
        excursionsPerMinute: (recentExcursions * 60) / (windowMs / 1000),
        excursionCount: tracker.excursionCount,
        alertCount,
        timeByLevelS,
    };
}

//------------------------------------------------------------------------------
/** Excursions are kept for this long at most, whatever `frequencyWindowS`. */
const MAX_WINDOW_MS = 10 * 60 * 1000;

type Tracker = {
    level: AngleZoneLevel;
    /** When the current level started. */
    levelSince: number;
    /** Since when the angle has continuously been at each level or worse, null when it isn't. */
    holdSince: Record<AngleZoneLevel, number | null>;
    /** Time spent at each level, up to `levelSince`. */
    timeByLevelMs: Record<AngleZoneLevel, number>;
    /** When the angle left the acceptable zones, over the last `MAX_WINDOW_MS`. */
    excursions: Array<number>;
    excursionCount: number;
};

function createTracker(level: AngleZoneLevel, time: number): Tracker {
    const rank = ANGLE_ZONE_LEVEL_RANKS[level];
    return {
        level,
        levelSince: time,
        holdSince: Object.fromEntries(
            LEVELS.map(holdLevel => {
                const holdRank = ANGLE_ZONE_LEVEL_RANKS[holdLevel];
                return [holdLevel, holdRank > 0 && holdRank <= rank ? time : null];
            }),
        ) as Record<AngleZoneLevel, number | null>,
        timeByLevelMs: { acceptable: 0, conditional: 0, notAcceptable: 0 },
        excursions: rank > 0 ? [time] : [],
        excursionCount: rank > 0 ? 1 : 0,
    };
}

function updateTracker(tracker: Tracker, level: AngleZoneLevel, time: number): void {
    if (level === tracker.level) {
        return;
    }

    tracker.timeByLevelMs[tracker.level] += time - tracker.levelSince;

    const rank = ANGLE_ZONE_LEVEL_RANKS[level];
    for (const holdLevel of LEVELS) {
        const holdRank = ANGLE_ZONE_LEVEL_RANKS[holdLevel];
        tracker.holdSince[holdLevel] = holdRank > 0 && holdRank <= rank ? (tracker.holdSince[holdLevel] ?? time) : null;
    }

    if (rank > 0 && ANGLE_ZONE_LEVEL_RANKS[tracker.level] === 0) {
        tracker.excursions.push(time);
        tracker.excursionCount++;
    }

    tracker.level = level;
    tracker.levelSince = time;
}

//------------------------------------------------------------------------------
/** Zone of the angle, which only changes once the angle has gone past its boundary by `hysteresisDeg`. */
function useZoneIndex(angleDeg: number, zones: ReadonlyArray<AngleZone>, hysteresisDeg: number): number {
    const [index, setIndex] = useState(() => findZoneIndex(angleDeg, zones));

    const zone = zones[index];
    const staysInZone =
        zone !== undefined && angleDeg >= zone.min - hysteresisDeg && angleDeg < zone.max + hysteresisDeg;
    const nextIndex = staysInZone ? index : findZoneIndex(angleDeg, zones);
    if (nextIndex !== index) {
        setIndex(nextIndex);
    }
    return nextIndex;
}

/** Calls `onAlert` once each time `status` becomes "alert", and counts the alerts. */
function useAlerts({
    status,
    alert,
    onAlert,
}: {
    status: AngleExposureStatus;
    alert: AngleExposureAlert;
    onAlert?: (alert: AngleExposureAlert) => void;
}): number {
    const [alertCount, setAlertCount] = useState(0);

    const latestRef = useRef({ alert, onAlert });
    useEffect(() => {
        latestRef.current = { alert, onAlert };
    });

    useEffect(() => {
        if (status !== "alert") {
            return;
        }
        setAlertCount(count => count + 1);
        latestRef.current.onAlert?.(latestRef.current.alert);
    }, [status]);

    return alertCount;
}

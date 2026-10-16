//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import { clamp, formatAngle } from "../../components/RotationGizmo/math";
import { formatSeconds } from "../../components/DOM3DAngle/format";
import type { AngleExposure } from "../../components/DOM3DAngle/useAngleExposure";
import {
    ANGLE_ZONE_LEVEL_LABELS,
    zoneBoundaries,
    type AngleZone,
    type AngleZoneLevel,
} from "../../components/DOM3DAngle/zones";
import styles from "./Readout.module.css";

//------------------------------------------------------------------------------
const METER_HEIGHT_PX = 72;

/** Names of the `--dom3d-angle-color-*` variables of the zones, inherited from `DOM3DAngle`. */
const LEVEL_CSS_NAMES: Record<AngleZoneLevel, string> = {
    acceptable: "acceptable",
    conditional: "conditional",
    notAcceptable: "not-acceptable",
};

//------------------------------------------------------------------------------
/**
 * Reading of the gauge, given as `children` to `DOM3DAngle`, which shows it beside the vertex, facing the
 * camera: the value, its level, the time it has been held there against the limit, and a vertical meter of the
 * angle on the scale of the zones, which reads even when the gauge itself is seen edge-on.
 */
export function Readout({
    label,
    angleDeg,
    uncertaintyDeg,
    exposure,
    zones,
    scaleRange,
}: {
    label: string;
    angleDeg: number;
    uncertaintyDeg: number;
    exposure: AngleExposure;
    zones: ReadonlyArray<AngleZone>;
    scaleRange: readonly [min: number, max: number];
}): React.JSX.Element {
    const { level } = exposure;

    return (
        <div className={styles.readout} data-level={level}>
            <Meter angleDeg={angleDeg} zones={zones} scaleRange={scaleRange} />
            <div className={styles.readoutText}>
                <span className={styles.caption}>{label}</span>
                <span className={styles.value}>
                    {formatAngle(angleDeg, 0)}
                    {uncertaintyDeg > 0 && (
                        <span className={styles.uncertainty}>±{formatAngle(uncertaintyDeg, 0)}</span>
                    )}
                </span>
                <span className={styles.levelLabel}>{ANGLE_ZONE_LEVEL_LABELS[level]}</span>
                {level !== "acceptable" && <Hold holdS={exposure.holdS} holdLimitS={exposure.holdLimitS} />}
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
/**
 * The angle on a vertical scale, from the bottom of `scaleRange` to its top, over the colors of the zones,
 * filled from 0° to the angle, with the boundaries of the zones marked.
 */
function Meter({
    angleDeg,
    zones,
    scaleRange,
}: {
    angleDeg: number;
    zones: ReadonlyArray<AngleZone>;
    scaleRange: readonly [min: number, max: number];
}): React.JSX.Element {
    const [min, max] = scaleRange;
    const toPx = (valueDeg: number): number => clamp((valueDeg - min) / (max - min), 0, 1) * METER_HEIGHT_PX;

    const stops = zones
        .map(zone => ({ from: toPx(zone.min), to: toPx(zone.max), level: zone.level }))
        .filter(stop => stop.to > stop.from)
        .map(stop => `var(--dom3d-angle-color-${LEVEL_CSS_NAMES[stop.level]}) ${stop.from}px ${stop.to}px`);
    const gradient = `linear-gradient(to top, ${stops.join(", ")})`;

    const fillBottom = toPx(Math.min(0, angleDeg));
    const fillTop = toPx(Math.max(0, angleDeg));
    const marks = [...new Set([0, ...zoneBoundaries(zones, scaleRange)])].filter(mark => mark > min && mark < max);

    return (
        <div className={styles.meter} style={{ height: METER_HEIGHT_PX }}>
            <div className={styles.meterTrack} style={{ backgroundImage: gradient }} />
            <div className={styles.meterFill} style={{ bottom: fillBottom, height: fillTop - fillBottom }}>
                <div
                    className={styles.meterFillColors}
                    style={{ bottom: -fillBottom, height: METER_HEIGHT_PX, backgroundImage: gradient }}
                />
            </div>
            {marks.map(mark => (
                <span key={mark} className={styles.meterMark} style={{ bottom: toPx(mark) }}>
                    {mark}
                </span>
            ))}
        </div>
    );
}

/** Time held at the current level against its limit, or since when, without a limit. */
function Hold({ holdS, holdLimitS }: { holdS: number; holdLimitS: number | null }): React.JSX.Element {
    if (holdLimitS === null) {
        return <span className={styles.hold}>Held {formatSeconds(holdS)}</span>;
    }

    return (
        <span className={styles.hold}>
            <span className={styles.holdBar}>
                <span className={styles.holdBarFill} style={{ width: `${Math.min(1, holdS / holdLimitS) * 100}%` }} />
            </span>
            {formatSeconds(holdS)} / {formatSeconds(holdLimitS)}
        </span>
    );
}

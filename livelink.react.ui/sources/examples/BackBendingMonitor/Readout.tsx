//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";
import { DOM3DAnchor } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { clamp, formatAngle } from "../RotationGizmo/math";
import { ANGLE_ZONE_LEVEL_LABELS, zoneBoundaries, type AngleZone, type AngleZoneLevel } from "./zones";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
const METER_HEIGHT_PX = 72;

//------------------------------------------------------------------------------
/**
 * Reading of the gauge, facing the camera so that it reads from any side, beside the vertex: the value, its
 * level, the time it has been held there against the limit, and a vertical meter of the angle on the scale of
 * the zones, which reads even when the gauge itself is seen edge-on.
 * @internal
 */
export function Readout({
    worldPosition,
    side,
    gapPx,
    pixelRatio,
    label,
    angleDeg,
    decimals,
    uncertaintyDeg,
    level,
    holdS,
    holdLimitS,
    zones,
    scaleRange,
    className,
    style,
}: {
    worldPosition: Vec3;
    /** Side of the vertex the readout is on, on screen. */
    side: "left" | "right";
    /** Distance between the vertex and the readout, in pixels. */
    gapPx: number;
    /** Scale bringing the content of `DOM3DAnchor` to 1 CSS pixel per screen pixel. */
    pixelRatio: number;
    label?: string;
    angleDeg: number;
    decimals: number;
    uncertaintyDeg: number;
    level: AngleZoneLevel;
    holdS: number;
    holdLimitS: number | null;
    zones: ReadonlyArray<AngleZone>;
    scaleRange: readonly [min: number, max: number];
    className: string;
    style: React.CSSProperties;
}): React.JSX.Element {
    const anchoredEdge = side === "right" ? "left" : "right";

    return (
        <DOM3DAnchor
            worldPosition={worldPosition}
            offset={`${anchoredEdge}-center`}
            className={className}
            style={{ ...style, pointerEvents: "none" }}
        >
            <div
                className={styles.readout}
                data-side={side}
                style={{
                    translate: `${(side === "right" ? gapPx : -gapPx) * pixelRatio}px 0`,
                    scale: String(pixelRatio),
                    transformOrigin: `${anchoredEdge} center`,
                }}
            >
                <Meter angleDeg={angleDeg} zones={zones} scaleRange={scaleRange} />
                <div className={styles.readoutText}>
                    {label && <span className={styles.caption}>{label}</span>}
                    <span className={styles.value}>
                        {formatAngle(angleDeg, decimals)}
                        {uncertaintyDeg > 0 && (
                            <span className={styles.uncertainty}>±{formatAngle(uncertaintyDeg, 0)}</span>
                        )}
                    </span>
                    <span className={styles.levelLabel}>{ANGLE_ZONE_LEVEL_LABELS[level]}</span>
                    {level !== "acceptable" && <Hold holdS={holdS} holdLimitS={holdLimitS} />}
                </div>
            </div>
        </DOM3DAnchor>
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
        .map(stop => `var(--dom3d-angle-alert-color-${LEVEL_CSS_NAMES[stop.level]}) ${stop.from}px ${stop.to}px`);
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

//------------------------------------------------------------------------------
/** @internal */
export const LEVEL_CSS_NAMES: Record<AngleZoneLevel, string> = {
    acceptable: "acceptable",
    conditional: "conditional",
    notAcceptable: "not-acceptable",
};

/** Seconds with a decimal under 10 s, e.g. "3.2 s", and as minutes and seconds from a minute, e.g. "1:05". */
export function formatSeconds(seconds: number): string {
    if (seconds < 10) {
        return `${(Math.floor(seconds * 10) / 10).toFixed(1)} s`;
    }
    if (seconds < 60) {
        return `${Math.floor(seconds)} s`;
    }
    const wholeSeconds = Math.floor(seconds);
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { clamp } from "../RotationGizmo/math";
import type { Projector } from "./CameraFacingLayer";
import type { Point } from "./geometry";
import type { AngleZoneLevel } from "./zones";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
/**
 * Shape of what the angle measures, when it isn't a straight line from the vertex, e.g. the joints of an
 * articulated arm.
 */
export type DOM3DAngleAlertCurve = {
    /**
     * World positions along it, from the vertex end outward. Drawn as a smooth curve through them.
     */
    points: ReadonlyArray<Vec3>;
};

//------------------------------------------------------------------------------
const POINT_RADIUS_PX = 3.6;
const LABEL_OFFSET_PX = 16;

/**
 * A curve through the points of `curve`, smoothed as a Catmull-Rom spline, with a dot on each point, in the color
 * of the current zone.
 *
 * It is also the progress bar of the time held: in a zone with a hold limit, it fills from its first point to its
 * last, up to the limit. Elsewhere, it is filled. The label is written past its end.
 * @internal
 */
export function CurveDrawing({
    curve,
    project,
    level,
    holdProgress,
    label,
}: {
    curve: DOM3DAngleAlertCurve;
    project: Projector;
    level: AngleZoneLevel;
    /** Time held in the current zone over its limit, from 0 to 1, or null when not timed. */
    holdProgress: number | null;
    /** Text past the end of the curve, e.g. the value. */
    label?: string;
}): React.JSX.Element | null {
    const projected = curve.points.map(project);
    if (projected.length < 2 || projected.some(point => point === null)) {
        return null;
    }
    const points = projected as Array<Point>;

    const path = catmullRomPath(points);
    const progress = holdProgress === null ? 1 : clamp(holdProgress, 0, 1);

    // Past the end of the curve, away from the rest of it.
    const end = points[points.length - 1]!;
    const beforeEnd = points[points.length - 2]!;
    const endLength = Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y) || 1;
    const labelPosition = {
        x: end.x + ((end.x - beforeEnd.x) / endLength) * LABEL_OFFSET_PX,
        y: end.y + ((end.y - beforeEnd.y) / endLength) * LABEL_OFFSET_PX,
    };

    return (
        <g data-level={level}>
            <path className={styles.curveOutline} d={path} />
            {holdProgress !== null && <path className={styles.curveTrack} d={path} />}
            {progress > 0 && (
                <path
                    className={styles.curveProgress}
                    d={path}
                    pathLength={1}
                    strokeDasharray={progress < 1 ? `${progress} 1` : undefined}
                />
            )}
            {points.map((point, index) => (
                <circle key={index} className={styles.curvePoint} cx={point.x} cy={point.y} r={POINT_RADIUS_PX} />
            ))}
            {label && (
                <text
                    className={styles.curveLabel}
                    x={labelPosition.x}
                    y={labelPosition.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                >
                    {label}
                </text>
            )}
        </g>
    );
}

/**
 * The vertex of the angle on its own, in the color of the current zone.
 * @internal
 */
export function VertexDot({
    position,
    project,
    level,
}: {
    position: Vec3;
    project: Projector;
    level: AngleZoneLevel;
}): React.JSX.Element | null {
    const point = project(position);
    if (!point) {
        return null;
    }
    return <circle className={styles.curvePoint} data-level={level} cx={point.x} cy={point.y} r={POINT_RADIUS_PX} />;
}

/** The Catmull-Rom spline through `points`, the ends repeated, as cubic Béziers. */
function catmullRomPath(points: ReadonlyArray<Point>): string {
    const sections = points.slice(0, -1).map((start, index) => {
        const before = points[index - 1] ?? start;
        const end = points[index + 1]!;
        const after = points[index + 2] ?? end;
        const control1 = { x: start.x + (end.x - before.x) / 6, y: start.y + (end.y - before.y) / 6 };
        const control2 = { x: end.x - (after.x - start.x) / 6, y: end.y - (after.y - start.y) / 6 };
        return `C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
    });
    return `M ${points[0]!.x} ${points[0]!.y} ${sections.join(" ")}`;
}

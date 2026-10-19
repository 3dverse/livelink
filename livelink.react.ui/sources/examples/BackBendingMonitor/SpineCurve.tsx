//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { clamp, formatAngle } from "../../components/RotationGizmo/math";
import { CameraFacingLayer, type Projector } from "../../components/DOM3DAngle/CameraFacingLayer";
import { formatSeconds } from "../../components/DOM3DAngle/format";
import type { Point } from "../../components/DOM3DAngle/geometry";
import type { AngleExposure } from "../../components/DOM3DAngle/useAngleExposure";
import { useViewportCamera } from "../../components/DOM3DAngle/useViewportCamera";
import styles from "./SpineCurve.module.css";

//------------------------------------------------------------------------------
const POINT_RADIUS_PX = 3.6;
const LABEL_OFFSET_PX = 16;
/** Room around the curve, for the value above it. */
const MARGIN_PX = 48;

//------------------------------------------------------------------------------
/**
 * The spine, from the hip joint center, the vertex of the trunk inclination, through its pivots to the base of the
 * neck: a smooth curve facing the camera, so that it reads from any side, under `DOM3DAngle`, in the color of the
 * zone of the trunk inclination. Its shape shows a rounded back, which the straight trunk line hides.
 *
 * It is also the progress bar of the time held: in a zone with a hold limit, it fills from the hips to the neck, up
 * to the limit, then pulses. Elsewhere, e.g. in the acceptable zone, it stays as it is before it fills. With
 * `showValue`, the value and the time held are written above it.
 */
export function SpineCurve({
    hipCenter,
    spinePoints,
    angleDeg,
    exposure,
    showValue,
}: {
    hipCenter: Vec3;
    /** Pivots of the spine, from its base at the hips, to the base of the neck. */
    spinePoints: ReadonlyArray<Vec3>;
    /** Trunk inclination, in degrees. */
    angleDeg: number;
    exposure: AngleExposure;
    showValue: boolean;
}): React.JSX.Element | null {
    const viewportCamera = useViewportCamera();
    if (!viewportCamera) {
        return null;
    }

    const isTimed = exposure.level !== "acceptable";
    const holdProgress = isTimed && exposure.holdLimitS ? exposure.holdS / exposure.holdLimitS : null;
    const points = [hipCenter, ...spinePoints];
    const label = showValue
        ? formatAngle(angleDeg, 0) + (isTimed ? ` · ${formatSeconds(exposure.holdS)}` : "")
        : undefined;

    return (
        <CameraFacingLayer
            anchor={hipCenter}
            viewportCamera={viewportCamera}
            extent={points}
            marginPx={MARGIN_PX}
            // Under DOM3DAngle, so that its needle, its values and the readout stay readable over the spine.
            stacking="under"
            className={styles.spine}
        >
            {project => (
                <CurveDrawing
                    points={points}
                    project={project}
                    exposure={exposure}
                    holdProgress={holdProgress}
                    label={label}
                />
            )}
        </CameraFacingLayer>
    );
}

//------------------------------------------------------------------------------
/**
 * A curve through `points`, smoothed as a Catmull-Rom spline, with a dot on each point, filled up to `holdProgress`,
 * if timed, and `label` written past its end.
 */
function CurveDrawing({
    points: worldPoints,
    project,
    exposure,
    holdProgress,
    label,
}: {
    points: ReadonlyArray<Vec3>;
    project: Projector;
    exposure: AngleExposure;
    /** Time held in the current zone over its limit, from 0 to 1, or null when not timed. */
    holdProgress: number | null;
    label?: string;
}): React.JSX.Element | null {
    const projected = worldPoints.map(project);
    if (projected.length < 2 || projected.some(point => point === null)) {
        return null;
    }
    const points = projected as Array<Point>;

    const path = catmullRomPath(points);
    const progress = holdProgress === null ? 0 : clamp(holdProgress, 0, 1);

    // Past the end of the curve, away from the rest of it.
    const end = points[points.length - 1]!;
    const beforeEnd = points[points.length - 2]!;
    const endLength = Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y) || 1;
    const labelPosition = {
        x: end.x + ((end.x - beforeEnd.x) / endLength) * LABEL_OFFSET_PX,
        y: end.y + ((end.y - beforeEnd.y) / endLength) * LABEL_OFFSET_PX,
    };

    return (
        <g className={styles.curve} data-level={exposure.level} data-status={exposure.status}>
            <path className={styles.track} d={path} />
            {progress > 0 && (
                <path
                    className={styles.progress}
                    d={path}
                    pathLength={1}
                    strokeDasharray={progress < 1 ? `${progress} 1` : undefined}
                />
            )}
            {points.map((point, index) => (
                <circle key={index} className={styles.point} cx={point.x} cy={point.y} r={POINT_RADIUS_PX} />
            ))}
            {label && (
                <text
                    className={styles.label}
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

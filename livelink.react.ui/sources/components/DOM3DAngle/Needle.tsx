//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { clamp } from "../RotationGizmo/math";
import type { Projector } from "./CameraFacingLayer";
import type { ShownLevel } from "./zones";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
const POINT_RADIUS_PX = 3.6;

/**
 * The needle, the straight line from the vertex along the angle, with a dot at each end, in the color of the
 * current zone.
 *
 * It is also the progress bar of the time held: in a zone with a hold limit, it fills from the vertex to its tip,
 * up to the limit. Elsewhere, it is filled.
 * @internal
 */
export function NeedleDrawing({
    from,
    to,
    project,
    level,
    holdProgress,
}: {
    from: Vec3;
    to: Vec3;
    project: Projector;
    level: ShownLevel;
    /** Time held in the current zone over its limit, from 0 to 1, or null when not timed. */
    holdProgress: number | null;
}): React.JSX.Element | null {
    const start = project(from);
    const tip = project(to);
    if (!start || !tip) {
        return null;
    }

    const path = `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`;
    const progress = holdProgress === null ? 1 : clamp(holdProgress, 0, 1);

    return (
        <g data-level={level}>
            {holdProgress !== null && <path className={styles.needleTrack} d={path} />}
            {progress > 0 && (
                <path
                    className={styles.needleProgress}
                    d={path}
                    pathLength={1}
                    strokeDasharray={progress < 1 ? `${progress} 1` : undefined}
                />
            )}
            <circle className={styles.needlePoint} cx={start.x} cy={start.y} r={POINT_RADIUS_PX} />
            <circle className={styles.needlePoint} cx={tip.x} cy={tip.y} r={POINT_RADIUS_PX} />
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
    level: ShownLevel;
}): React.JSX.Element | null {
    const point = project(position);
    if (!point) {
        return null;
    }
    return <circle className={styles.needlePoint} data-level={level} cx={point.x} cy={point.y} r={POINT_RADIUS_PX} />;
}

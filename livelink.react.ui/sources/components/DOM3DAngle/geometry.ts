//------------------------------------------------------------------------------
import { DEG_TO_RAD, clamp } from "../RotationGizmo/math";

//------------------------------------------------------------------------------
// The gauge is drawn in a 100 x 100 viewBox, around its center. 0° points up, and positive angles go
// clockwise on screen, which is the direction the gauge is laid in the world, see `computePlane`.

export type Point = { x: number; y: number };

export const VIEWBOX_SIZE = 100;
export const CENTER: Point = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 };

/** Arcs are capped just short of a full turn, which SVG arcs can't draw. */
const MAX_SWEEP_DEG = 359.9;

//------------------------------------------------------------------------------
/** Point at `length` from `center`, `angleDeg` clockwise from straight up. */
export function pointAtAngle(center: Point, length: number, angleDeg: number): Point {
    const angleRad = angleDeg * DEG_TO_RAD;
    return {
        x: center.x + length * Math.sin(angleRad),
        y: center.y - length * Math.cos(angleRad),
    };
}

//------------------------------------------------------------------------------
/** Closed sector of a disc, from `fromDeg` to `toDeg`. */
export function wedgePath(center: Point, radius: number, fromDeg: number, toDeg: number): string {
    const arc = arcCommand(center, radius, fromDeg, toDeg);
    return arc ? `M ${center.x} ${center.y} L ${arc.start.x} ${arc.start.y} ${arc.command} Z` : "";
}

/** Open arc of a circle, from `fromDeg` to `toDeg`. */
export function arcPath(center: Point, radius: number, fromDeg: number, toDeg: number): string {
    const arc = arcCommand(center, radius, fromDeg, toDeg);
    return arc ? `M ${arc.start.x} ${arc.start.y} ${arc.command}` : "";
}

function arcCommand(
    center: Point,
    radius: number,
    fromDeg: number,
    toDeg: number,
): { start: Point; command: string } | null {
    const sweepDeg = clamp(toDeg - fromDeg, -MAX_SWEEP_DEG, MAX_SWEEP_DEG);
    if (radius <= 0 || sweepDeg === 0) {
        return null;
    }

    const start = pointAtAngle(center, radius, fromDeg);
    const end = pointAtAngle(center, radius, fromDeg + sweepDeg);
    const largeArcFlag = Math.abs(sweepDeg) > 180 ? 1 : 0;
    // Positive angles go clockwise, which is SVG's positive sweep direction, y pointing down.
    const sweepFlag = sweepDeg > 0 ? 1 : 0;
    return { start, command: `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}` };
}

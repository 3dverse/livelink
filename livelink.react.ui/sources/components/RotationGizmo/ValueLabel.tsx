//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import { CENTER, type DialPoint, type Ring } from "./dial";
import { formatAngle } from "./math";
import type { RotationGizmoAxis, RotationGizmoVisibility } from "./types";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
/** Distance from the handle to its value, in viewBox units. */
const VALUE_LABEL_OFFSET = 7.5;
/** Beyond this, the label is aligned on the side of the handle rather than centered on it. */
const ALIGNMENT_THRESHOLD = 0.35;
/**
 * Minimum number of characters of the angle, before the degree sign, so that the label keeps its width
 * while the angle changes, e.g. from 9° to 10° or −10°.
 */
const MIN_ANGLE_LENGTH = 3;
/** As wide as a digit in tabular figures, and not collapsed like a regular space. */
const FIGURE_SPACE = "\u2007";

//------------------------------------------------------------------------------
export type ValueLabelOptions = {
    showValues: RotationGizmoVisibility;
    showAxisLabels: RotationGizmoVisibility;
    decimals: number;
    axisLabels?: Partial<Record<RotationGizmoAxis, string>>;
    /**
     * Whether the gizmo is hovered: every axis then shows its value, with its name, to tell which gizmo and
     * which axis is under the pointer when gizmos overlap.
     */
    isGizmoHovered: boolean;
};

/**
 * Angle of a ring next to its handle, on the side away from the center of the gizmo so that it doesn't cover
 * it, like the delta readout of a 3D editor. With `showValues: "always"`, displayed once the ring is rotated,
 * and for every ring while the gizmo is highlighted.
 *
 * @param handle - Position of the handle, in viewBox coordinates.
 */
export function ValueLabel({
    ring,
    angleDeg,
    handle,
    options: { showValues, showAxisLabels, decimals, axisLabels, isGizmoHovered },
}: {
    ring: Ring;
    angleDeg: number;
    handle: DialPoint;
    options: ValueLabelOptions;
}): React.JSX.Element | null {
    const formattedAngle = formatAngle(angleDeg, decimals);
    const isRotated = formattedAngle !== formatAngle(0, decimals);
    if (!isVisible(showValues, isGizmoHovered) || (!isRotated && !isGizmoHovered)) {
        return null;
    }

    let directionX = handle.x - CENTER;
    let directionY = handle.y - CENTER;
    const length = Math.hypot(directionX, directionY);
    if (length < 1) {
        // The handle is on the center, e.g. at the tip of an axis pointing at the viewer.
        directionX = 0;
        directionY = -1;
    } else {
        directionX /= length;
        directionY /= length;
    }

    const textAnchor =
        directionX > ALIGNMENT_THRESHOLD ? "start" : directionX < -ALIGNMENT_THRESHOLD ? "end" : "middle";
    // Padded on the side away from the anchor, so that the digits don't move as the width of the angle changes.
    const paddedLength = MIN_ANGLE_LENGTH + "°".length;
    const paddedAngle =
        textAnchor === "start"
            ? formattedAngle.padEnd(paddedLength, FIGURE_SPACE)
            : formattedAngle.padStart(paddedLength, FIGURE_SPACE);
    const axisLabel = isVisible(showAxisLabels, isGizmoHovered) ? axisLabels?.[ring.axis] : undefined;

    return (
        <text
            className={styles.valueLabel}
            style={{ ["--axis-color" as string]: ring.color } as React.CSSProperties}
            x={handle.x + directionX * VALUE_LABEL_OFFSET}
            y={handle.y + directionY * VALUE_LABEL_OFFSET}
            textAnchor={textAnchor}
            dominantBaseline={
                directionY > ALIGNMENT_THRESHOLD ? "hanging" : directionY < -ALIGNMENT_THRESHOLD ? "auto" : "central"
            }
        >
            {axisLabel ? `${axisLabel} ${paddedAngle}` : paddedAngle}
        </text>
    );
}

//------------------------------------------------------------------------------
function isVisible(visibility: RotationGizmoVisibility, isGizmoHovered: boolean): boolean {
    return visibility === "always" || (visibility === "hover" && isGizmoHovered);
}

//------------------------------------------------------------------------------
import React from "react";
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import {
    AXIS_INDEX,
    CENTER,
    HANDLE_RADIUS,
    MIN_DISPLAYED_ANGLE_DEG,
    NEEDLE_RADIUS,
    type DialGeometry,
    type DialPoint,
    type Ring,
} from "./dial";
import { clamp, DEG_TO_RAD } from "./math";
import type { DialInteraction } from "./useDialInteraction";
import { ValueLabel, type ValueLabelOptions } from "./ValueLabel";
import type { DialParts } from "./types";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
/** Radius of the outermost ring, leaving room for the handle and its stroke. */
const OUTER_RADIUS = 43;
const RING_SPACING = 11;
/** Distance from a ring within which a pointer grabs it. */
const RING_HIT_TOLERANCE = RING_SPACING / 2;
/** Radius within which the pointer hovers the gizmo, in viewBox units. */
export const FLAT_HOVER_RADIUS = OUTER_RADIUS + RING_HIT_TOLERANCE;
const REFERENCE_TICK_LENGTH = 5;

//------------------------------------------------------------------------------
/**
 * Rings from the outermost inwards, packed so that hiding an axis doesn't leave a gap.
 */
function ringRadius(index: number): number {
    return OUTER_RADIUS - index * RING_SPACING;
}

//------------------------------------------------------------------------------
export function createFlatGeometry(rings: ReadonlyArray<Ring>): DialGeometry {
    return {
        hitTest: pointer => {
            const radius = Math.hypot(pointer.x, pointer.y);
            let closestRing: Ring | undefined;
            let closestDistance = RING_HIT_TOLERANCE;
            rings.forEach((ring, index) => {
                const distance = Math.abs(ringRadius(index) - radius);
                if (ring.mode === "edit" && distance <= closestDistance) {
                    closestRing = ring;
                    closestDistance = distance;
                }
            });
            return closestRing;
        },
        beginDrag: () => ({ angleAt: pointerAngleDeg }),
    };
}

/** Angle of the pointer counter-clockwise from the 0° mark at the top. */
function pointerAngleDeg({ x, y }: DialPoint): number {
    return Math.atan2(-x, -y) / DEG_TO_RAD;
}

//------------------------------------------------------------------------------
/**
 * Concentric rings facing the screen, each one drawing an arc from its 0° mark at the top to its angle.
 */
export function FlatDial({
    value,
    rings,
    interaction,
    axisNames,
    valueLabelOptions,
    parts,
}: {
    value: Vec3;
    rings: ReadonlyArray<Ring>;
    interaction: DialInteraction;
    axisNames: Record<Ring["axis"], string>;
    valueLabelOptions: ValueLabelOptions;
    parts: Pick<DialParts, "referenceMarks" | "outOfRange">;
}): React.JSX.Element {
    const valueLabels: Array<React.ReactNode> = [];

    return (
        <>
            {rings.map((ring, index) => {
                const radius = ringRadius(index);
                const angleDeg = value[AXIS_INDEX[ring.axis]];
                const displayedAngleDeg = clamp(angleDeg, -359.9, 359.9);
                const handle = pointOnRing(radius, displayedAngleDeg);
                const isLimited = ring.max - ring.min < 360;
                const ringClassName = [
                    styles.ring,
                    ring.axis === interaction.highlightedAxis ? styles.highlighted : undefined,
                    ring.axis === interaction.activeAxis ? styles.active : undefined,
                ]
                    .filter(Boolean)
                    .join(" ");

                valueLabels.push(
                    <ValueLabel
                        key={ring.axis}
                        ring={ring}
                        angleDeg={angleDeg}
                        handle={handle}
                        options={valueLabelOptions}
                    />,
                );

                return (
                    <g
                        key={ring.axis}
                        className={ringClassName}
                        style={{ ["--axis-color" as string]: ring.color } as React.CSSProperties}
                        data-axis={ring.axis}
                    >
                        {ring.mode === "edit" && (
                            <circle
                                className={styles.hitArea}
                                cx={CENTER}
                                cy={CENTER}
                                r={radius}
                                strokeWidth={RING_HIT_TOLERANCE * 2}
                            />
                        )}
                        {(!isLimited || parts.outOfRange) && (
                            <circle
                                className={isLimited ? styles.outOfRange : styles.track}
                                cx={CENTER}
                                cy={CENTER}
                                r={radius}
                            />
                        )}
                        {isLimited && <path className={styles.track} d={arcPath(radius, ring.min, ring.max)} />}
                        {parts.referenceMarks && (
                            <line
                                className={styles.referenceTick}
                                x1={CENTER}
                                y1={CENTER - radius - REFERENCE_TICK_LENGTH / 2}
                                x2={CENTER}
                                y2={CENTER - radius + REFERENCE_TICK_LENGTH / 2}
                            />
                        )}
                        {Math.abs(displayedAngleDeg) >= MIN_DISPLAYED_ANGLE_DEG && (
                            <>
                                <path className={styles.deltaGlow} d={arcPath(radius, 0, displayedAngleDeg)} />
                                <path className={styles.delta} d={arcPath(radius, 0, displayedAngleDeg)} />
                            </>
                        )}
                        {ring.mode === "edit" ? (
                            <circle
                                className={styles.handle}
                                cx={handle.x}
                                cy={handle.y}
                                r={HANDLE_RADIUS}
                                {...interaction.getHandleProps(ring, axisNames[ring.axis])}
                            />
                        ) : (
                            <circle className={styles.needle} cx={handle.x} cy={handle.y} r={NEEDLE_RADIUS} />
                        )}
                    </g>
                );
            })}
            {valueLabels}
        </>
    );
}

//------------------------------------------------------------------------------
/** Point of the ring of `radius` at `angleDeg` counter-clockwise from the top. */
function pointOnRing(radius: number, angleDeg: number): DialPoint {
    const angleRad = angleDeg * DEG_TO_RAD;
    return {
        x: CENTER - radius * Math.sin(angleRad),
        y: CENTER - radius * Math.cos(angleRad),
    };
}

/** Arc of the ring of `radius` going from `fromDeg` to `toDeg`, counter-clockwise when `toDeg > fromDeg`. */
function arcPath(radius: number, fromDeg: number, toDeg: number): string {
    const sweepDeg = toDeg - fromDeg;
    const start = pointOnRing(radius, fromDeg);
    const end = pointOnRing(radius, toDeg);
    const largeArcFlag = Math.abs(sweepDeg) > 180 ? 1 : 0;
    // The y axis of the viewBox points down, so a counter-clockwise arc has a sweep-flag of 0.
    const sweepFlag = sweepDeg >= 0 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

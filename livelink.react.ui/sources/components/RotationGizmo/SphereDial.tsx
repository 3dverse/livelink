//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Quat, Vec3 } from "@3dverse/livelink";
import { ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import {
    AXIS_INDEX,
    CENTER,
    HANDLE_RADIUS,
    MIN_DISPLAYED_ANGLE_DEG,
    NEEDLE_RADIUS,
    distance,
    type DialGeometry,
    type DialPoint,
    type Ring,
} from "./dial";
import { axisAngleToQuat, clamp, conjugateQuat, DEG_TO_RAD, multiplyQuat, rotateVec3 } from "./math";
import type { RotationGizmoAxis, DialParts } from "./types";
import type { DialInteraction } from "./useDialInteraction";
import { ValueLabel, type ValueLabelOptions } from "./ValueLabel";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
const SPHERE_RADIUS = 38;
const SAMPLE_STEP_DEG = 3;
const RING_HIT_TOLERANCE = 4.5;
/** Radius within which the pointer hovers the gizmo, in viewBox units. */
export const SPHERE_HOVER_RADIUS = SPHERE_RADIUS + RING_HIT_TOLERANCE;
/** Added to the distance to the back of the sphere, so that the front wins where two rings cross. */
const BACK_HIT_PENALTY = 2;
/** Subtracted from the distance to a handle, so that it wins over a ring crossing it. */
const HANDLE_HIT_BONUS = 3;
/**
 * Below this, the ellipse of a ring is too narrow to map the pointer to a point of it: a small move across
 * it would make the angle jump. It is the ratio of the minor axis of the ellipse to its major axis.
 */
const EDGE_ON_THRESHOLD = 0.5;
/** Handles grow towards the viewer and shrink away from it, by up to this fraction of their size. */
const HANDLE_DEPTH_SCALE = 0.15;
const POLE_LABEL_DISTANCE = 1.2;
const REFERENCE_TICK_HALF_LENGTH = 0.08;

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

/** Three-quarter view from above, used outside of a viewport, so that every ring shows as an ellipse. */
const DEFAULT_VIEW_ORIENTATION = multiplyQuat(axisAngleToQuat([0, 1, 0], 35), axisAngleToQuat([1, 0, 0], -25));

//------------------------------------------------------------------------------
/**
 * A ring in view space, x pointing right, y up, and z towards the viewer: `n` is its axis, `u` its 0°
 * direction and `v` its 90° direction, so that positive angles turn counter-clockwise as seen from the tip of
 * the axis. The 0° mark is on the next axis: y for the x ring, z for the y ring, and x for the z ring.
 */
type RingBasis = { u: Vec3; v: Vec3; n: Vec3 };

export type SphereView = Record<RotationGizmoAxis, RingBasis>;

/**
 * The rings of the sphere as seen by the viewer.
 */
export function computeSphereView(orientation: Quat | undefined, viewOrientation: Quat | null | undefined): SphereView {
    const toView = multiplyQuat(
        conjugateQuat(viewOrientation ?? DEFAULT_VIEW_ORIENTATION),
        orientation ?? IDENTITY_QUAT,
    );
    const [x, y, z] = (
        [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ] as Array<Vec3>
    ).map(axis => rotateVec3(toView, axis));

    return { x: { n: x, u: y, v: z }, y: { n: y, u: z, v: x }, z: { n: z, u: x, v: y } };
}

//------------------------------------------------------------------------------
/**
 * Orientation of the camera of the viewport the gizmo is rendered in, if any, following it as it moves.
 */
export function useViewportCameraOrientation(enabled: boolean): Quat | null {
    const { camera } = useContext(ViewportContext);
    const cameraEntity = enabled ? (camera?.camera_entity ?? null) : null;
    const [orientation, setOrientation] = useState<Quat | null>(null);

    useEffect(() => {
        if (!cameraEntity) {
            setOrientation(null);
            return;
        }

        const updateOrientation = (): void => setOrientation([...cameraEntity.global_transform.orientation] as Quat);
        updateOrientation();
        cameraEntity.addEventListener("on-entity-updated", updateOrientation);
        return (): void => cameraEntity.removeEventListener("on-entity-updated", updateOrientation);
    }, [cameraEntity]);

    return orientation;
}

//------------------------------------------------------------------------------
/**
 * What doesn't depend on the angles of a ring: its projection, and the paths drawn from it. Computed once per
 * view, and shared by the drawing and the hit testing, which runs on every pointer move.
 */
type RingProjection = {
    basis: RingBasis;
    /** Points of the whole ring, every few degrees. */
    samples: Array<RingPoint>;
    trackSegments: Array<{ d: string; isFront: boolean; isInRange: boolean }>;
    hitAreaPath: string;
    referenceMark: { start: ProjectedPoint; end: ProjectedPoint };
    pole: ProjectedPoint;
};

export type SphereRings = Partial<Record<RotationGizmoAxis, RingProjection>>;

export function computeSphereRings(rings: ReadonlyArray<Ring>, view: SphereView): SphereRings {
    const sphereRings: SphereRings = {};
    for (const ring of rings) {
        const basis = view[ring.axis];
        const samples = sampleRing(basis, -180, 180);
        sphereRings[ring.axis] = {
            basis,
            samples,
            trackSegments: splitPoints(samples, point => isInRange(point.angleDeg, ring)).map(segment => ({
                d: polylinePath(segment.points),
                isFront: segment.isFront,
                isInRange: segment.key,
            })),
            hitAreaPath: `${polylinePath(samples)} Z`,
            referenceMark: {
                start: projectOnRing(basis, 0, 1 - REFERENCE_TICK_HALF_LENGTH),
                end: projectOnRing(basis, 0, 1 + REFERENCE_TICK_HALF_LENGTH),
            },
            pole: projectDirection(basis.n, POLE_LABEL_DISTANCE),
        };
    }
    return sphereRings;
}

//------------------------------------------------------------------------------
export function createSphereGeometry(rings: ReadonlyArray<Ring>, sphereRings: SphereRings, value: Vec3): DialGeometry {
    return {
        hitTest: pointer => {
            let closestRing: Ring | undefined;
            let closestDistance = RING_HIT_TOLERANCE;
            const consider = (ring: Ring, point: ProjectedPoint, bonus: number): void => {
                const pointDistance = distance(pointer, point) - bonus + (point.depth < 0 ? BACK_HIT_PENALTY : 0);
                if (pointDistance < closestDistance) {
                    closestRing = ring;
                    closestDistance = pointDistance;
                }
            };

            for (const ring of rings) {
                if (ring.mode !== "edit") {
                    continue;
                }
                const { basis, samples } = sphereRings[ring.axis]!;
                consider(ring, projectOnRing(basis, value[AXIS_INDEX[ring.axis]]), HANDLE_HIT_BONUS);
                for (const point of samples) {
                    consider(ring, point, 0);
                }
            }
            return closestRing;
        },

        beginDrag: (ring, _pointer, angleDeg) => {
            const { u, v, n } = sphereRings[ring.axis]!.basis;
            // The axes of the ring on screen, y pointing down.
            const [ux, uy, vx, vy] = [u[0], -u[1], v[0], -v[1]];

            if (Math.abs(n[2]) >= EDGE_ON_THRESHOLD) {
                // The view being orthographic, the point of the plane of the ring under the pointer is
                // a·u + b·v, with a and b solving pointer = a·u + b·v on screen, and its angle is atan2(b, a).
                // The determinant is ±n.z, so it isn't 0 above the threshold.
                const determinant = ux * vy - vx * uy;
                return {
                    angleAt: ({ x, y }) =>
                        Math.atan2((ux * y - x * uy) / determinant, (x * vy - vx * y) / determinant) / DEG_TO_RAD,
                };
            }

            // Seen edge-on, the ring is almost a line and its points can't be told apart, so the pointer moves
            // the handle along the tangent of the ring where it was grabbed, a radius turning it by one radian,
            // like the rotation gizmos of 3D editors.
            const angleRad = angleDeg * DEG_TO_RAD;
            let tangentX = -Math.sin(angleRad) * ux + Math.cos(angleRad) * vx;
            let tangentY = -Math.sin(angleRad) * uy + Math.cos(angleRad) * vy;
            if (Math.hypot(tangentX, tangentY) < 0.3) {
                // At the ends of the line the tangent points at the viewer, so move along the line instead:
                // the direction of the plane perpendicular to the view, n × z, which is (n.y, n.x) on screen.
                const sign = n[1] * tangentX + n[0] * tangentY < 0 ? -1 : 1;
                tangentX = sign * n[1];
                tangentY = sign * n[0];
            }
            const tangentLength = Math.hypot(tangentX, tangentY) || 1;
            tangentX /= tangentLength;
            tangentY /= tangentLength;

            return {
                angleDeltaBetween: (from, to) =>
                    ((to.x - from.x) * tangentX + (to.y - from.y) * tangentY) / SPHERE_RADIUS / DEG_TO_RAD,
            };
        },
    };
}

//------------------------------------------------------------------------------
/**
 * The rings drawn around their own axis on a sphere, as seen by the viewer. Each one fills the sector from
 * its 0° mark to its angle, so the delta reads as a rotation in the plane it actually happens in. The sphere
 * and the rings stay faint, and what lies on their far side is dimmed, so that the deltas stand out.
 */
export function SphereDial({
    value,
    rings,
    sphereRings,
    interaction,
    axisNames,
    valueLabelOptions,
    parts,
}: {
    value: Vec3;
    rings: ReadonlyArray<Ring>;
    sphereRings: SphereRings;
    interaction: DialInteraction;
    axisNames: Record<RotationGizmoAxis, string>;
    valueLabelOptions: ValueLabelOptions;
    parts: DialParts;
}): React.JSX.Element {
    const hitAreaLayer: Array<React.ReactNode> = [];
    const backLayer: Array<React.ReactNode> = [];
    const frontLayer: Array<React.ReactNode> = [];
    const deltaLayer: Array<React.ReactNode> = [];
    const handleLayer: Array<React.ReactNode> = [];

    for (const ring of rings) {
        const { basis, trackSegments, hitAreaPath, referenceMark, pole } = sphereRings[ring.axis]!;
        const angleDeg = clamp(value[AXIS_INDEX[ring.axis]], -359.9, 359.9);
        const ringProps = {
            className: [
                styles.ring,
                ring.axis === interaction.highlightedAxis ? styles.highlighted : undefined,
                ring.axis === interaction.activeAxis ? styles.active : undefined,
            ]
                .filter(Boolean)
                .join(" "),
            style: { ["--axis-color" as string]: ring.color } as React.CSSProperties,
            "data-axis": ring.axis,
        };

        const back: Array<React.ReactNode> = [];
        const front: Array<React.ReactNode> = [];

        // Only the rings catch the pointer, so that it reaches the scene, or another gizmo, everywhere else.
        if (ring.mode === "edit") {
            hitAreaLayer.push(
                <path
                    key={ring.axis}
                    className={styles.hitArea}
                    d={hitAreaPath}
                    strokeWidth={RING_HIT_TOLERANCE * 2}
                />,
            );
        }

        // Track, in range or not.
        trackSegments.forEach((segment, index) => {
            if (!segment.isInRange && !parts.outOfRange) {
                return;
            }
            (segment.isFront ? front : back).push(
                <path
                    key={`track-${index}`}
                    className={segment.isInRange ? styles.track : styles.outOfRange}
                    d={segment.d}
                />,
            );
        });

        // 0° mark.
        const { start: tickStart, end: tickEnd } = referenceMark;
        if (parts.referenceMarks) {
            (tickStart.depth >= 0 ? front : back).push(
                <line
                    key="tick"
                    className={styles.referenceTick}
                    x1={CENTER + tickStart.x}
                    y1={CENTER + tickStart.y}
                    x2={CENTER + tickEnd.x}
                    y2={CENTER + tickEnd.y}
                />,
            );
        }

        // Delta, as a sector of the plane of the ring and an arc along it. Drawn over everything but the
        // handles, and never dimmed even on the far side, as it is what the gizmo is about.
        if (Math.abs(angleDeg) >= MIN_DISPLAYED_ANGLE_DEG) {
            const arcPoints = sampleRing(basis, 0, angleDeg);
            deltaLayer.push(
                <g key={ring.axis} {...ringProps}>
                    <path className={styles.sector} d={`M ${CENTER} ${CENTER} L ${polylinePoints(arcPoints)} Z`} />
                    <path className={styles.deltaGlow} d={polylinePath(arcPoints)} />
                    <path className={styles.delta} d={polylinePath(arcPoints)} />
                </g>,
            );
        }

        // Axis name at the tip of the axis.
        if (parts.poleLabels) {
            front.push(
                <text
                    key="pole"
                    className={[styles.poleLabel, pole.depth < 0 ? styles.behind : undefined].filter(Boolean).join(" ")}
                    x={CENTER + pole.x}
                    y={CENTER + pole.y}
                    aria-hidden
                >
                    {ring.axis.toUpperCase()}
                </text>,
            );
        }

        backLayer.push(
            <g key={ring.axis} {...ringProps}>
                {back}
            </g>,
        );
        frontLayer.push(
            <g key={ring.axis} {...ringProps}>
                {front}
            </g>,
        );

        // The handles stay in the same layer wherever they are, as moving the focused one to another layer
        // when it crosses the silhouette of the sphere would blur it.
        const handle = projectOnRing(basis, angleDeg);
        const handleClassName = (className: string): string =>
            [className, handle.depth < 0 ? styles.behind : undefined].filter(Boolean).join(" ");
        handleLayer.push(
            <g key={ring.axis} {...ringProps}>
                {ring.mode === "edit" ? (
                    <circle
                        className={handleClassName(styles.handle)}
                        cx={CENTER + handle.x}
                        cy={CENTER + handle.y}
                        r={HANDLE_RADIUS * (1 + HANDLE_DEPTH_SCALE * handle.depth)}
                        {...interaction.getHandleProps(ring, axisNames[ring.axis])}
                    />
                ) : (
                    <circle
                        className={handleClassName(styles.needle)}
                        cx={CENTER + handle.x}
                        cy={CENTER + handle.y}
                        r={NEEDLE_RADIUS}
                    />
                )}
                <ValueLabel
                    ring={ring}
                    angleDeg={value[AXIS_INDEX[ring.axis]]}
                    handle={{ x: CENTER + handle.x, y: CENTER + handle.y }}
                    options={valueLabelOptions}
                />
            </g>,
        );
    }

    return (
        <>
            <g className={styles.back}>{backLayer}</g>
            {parts.sphere && <circle className={styles.sphere} cx={CENTER} cy={CENTER} r={SPHERE_RADIUS} />}
            {frontLayer}
            {deltaLayer}
            {hitAreaLayer}
            {handleLayer}
        </>
    );
}

//------------------------------------------------------------------------------
type ProjectedPoint = DialPoint & {
    /** Towards the viewer from the center of the sphere, from -1 at the back to 1 at the front. */
    depth: number;
};

type RingPoint = ProjectedPoint & { angleDeg: number };

/** Point of the ring at `angleDeg`, at `scale` times the radius of the sphere, relative to its center. */
function projectOnRing({ u, v }: RingBasis, angleDeg: number, scale = 1): RingPoint {
    const cos = Math.cos(angleDeg * DEG_TO_RAD);
    const sin = Math.sin(angleDeg * DEG_TO_RAD);
    return {
        ...projectDirection([cos * u[0] + sin * v[0], cos * u[1] + sin * v[1], cos * u[2] + sin * v[2]], scale),
        angleDeg,
    };
}

function projectDirection(direction: Vec3, scale: number): ProjectedPoint {
    return {
        x: SPHERE_RADIUS * scale * direction[0],
        y: -SPHERE_RADIUS * scale * direction[1],
        depth: direction[2],
    };
}

/** Points of the ring from `fromDeg` to `toDeg`, both included. */
function sampleRing(basis: RingBasis, fromDeg: number, toDeg: number): Array<RingPoint> {
    const sampleCount = Math.max(1, Math.ceil(Math.abs(toDeg - fromDeg) / SAMPLE_STEP_DEG));
    return Array.from({ length: sampleCount + 1 }, (_, index) =>
        projectOnRing(basis, fromDeg + ((toDeg - fromDeg) * index) / sampleCount),
    );
}

/**
 * Splits consecutive points into the parts in front of and behind the center of the sphere, and wherever
 * `getKey` changes. Consecutive parts share their boundary point, so that they join.
 */
function splitPoints<Key>(
    points: ReadonlyArray<RingPoint>,
    getKey: (point: RingPoint) => Key,
): Array<{ points: Array<RingPoint>; isFront: boolean; key: Key }> {
    const segments: Array<{ points: Array<RingPoint>; isFront: boolean; key: Key }> = [];
    for (const point of points) {
        const isFront = point.depth >= 0;
        const key = getKey(point);
        const segment = segments.at(-1);
        if (segment && segment.isFront === isFront && segment.key === key) {
            segment.points.push(point);
        } else {
            segments.push({ points: segment ? [segment.points.at(-1)!, point] : [point], isFront, key });
        }
    }
    return segments;
}

function isInRange(angleDeg: number, { min, max }: Ring): boolean {
    return [angleDeg - 360, angleDeg, angleDeg + 360].some(angle => angle >= min && angle <= max);
}

function polylinePoints(points: ReadonlyArray<DialPoint>): string {
    return points.map(({ x, y }) => `${(CENTER + x).toFixed(2)} ${(CENTER + y).toFixed(2)}`).join(" L ");
}

function polylinePath(points: ReadonlyArray<DialPoint>): string {
    return `M ${polylinePoints(points)}`;
}

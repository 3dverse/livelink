//------------------------------------------------------------------------------
import type { RotationGizmoAxis, RotationGizmoAxisMode } from "./types";

//------------------------------------------------------------------------------
/** Dials are drawn in a 100x100 viewBox, scaled to the size of the gizmo. */
export const VIEWBOX_SIZE = 100;
export const CENTER = VIEWBOX_SIZE / 2;
export const HANDLE_RADIUS = 4.5;
export const NEEDLE_RADIUS = 2;
/** Below this angle the delta arc would be a dot under the handle, so it isn't drawn. */
export const MIN_DISPLAYED_ANGLE_DEG = 0.05;

export const AXIS_INDEX: Record<RotationGizmoAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

//------------------------------------------------------------------------------
/**
 * A displayed axis of the gizmo.
 */
export type Ring = {
    axis: RotationGizmoAxis;
    mode: RotationGizmoAxisMode;
    min: number;
    max: number;
    color: string;
};

/**
 * Point of the dial in viewBox units, relative to its center, with y pointing down.
 */
export type DialPoint = { x: number; y: number };

/**
 * How the pointer moves translate into angles while dragging a ring.
 */
export type DragMapping =
    /** The angle of the ring under the pointer: the drag starts by jumping to the grabbed point. */
    | { angleAt: (pointer: DialPoint) => number }
    /** The angle change for a pointer move, when the pointer can't be mapped to a point of the ring. */
    | { angleDeltaBetween: (from: DialPoint, to: DialPoint) => number };

/**
 * The part of the interaction that depends on how a variant draws its rings.
 */
export type DialGeometry = {
    /** Editable ring under the pointer, if any. */
    hitTest: (pointer: DialPoint) => Ring | undefined;

    /** Called when grabbing `ring`, whose angle is `angleDeg`. The mapping is kept for the whole drag. */
    beginDrag: (ring: Ring, pointer: DialPoint, angleDeg: number) => DragMapping;
};

export function distance(a: DialPoint, b: DialPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

//------------------------------------------------------------------------------
export type RotationGizmoAxis = "x" | "y" | "z";

/**
 * "edit" displays a handle that can be dragged along the ring (or moved with the keyboard), "read"
 * only displays the angle.
 */
export type RotationGizmoAxisMode = "edit" | "read";

/**
 * Axes to display, with their mode. Axes left out are hidden.
 */
export type RotationGizmoAxes = Partial<Record<RotationGizmoAxis, RotationGizmoAxisMode>>;

/**
 * Allowed `[min, max]` range per axis, in degrees.
 */
export type RotationGizmoLimits = Partial<Record<RotationGizmoAxis, readonly [min: number, max: number]>>;

/**
 * "default" draws the rings on a sphere, each one around its own axis as seen from the viewer. "flat"
 * draws them as concentric circles, all facing the screen.
 */
export type RotationGizmoVariant = "default" | "flat";

/**
 * When a part of the gizmo is displayed: "always", only while the gizmo is hovered or edited, or "never".
 */
export type RotationGizmoVisibility = "always" | "hover" | "never";

/**
 * Optional parts of the drawing of the gizmo. The deltas, the rings, and the handles are always drawn.
 * @internal
 */
export type DialParts = {
    sphere: boolean;
    poleLabels: boolean;
    referenceMarks: boolean;
    outOfRange: boolean;
};

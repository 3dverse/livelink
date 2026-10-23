//------------------------------------------------------------------------------
import React, { useContext, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import type { Quat, Vec3 } from "@3dverse/livelink";
import { DOM3DAnchor, ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { CENTER, VIEWBOX_SIZE, type Ring } from "./dial";
import { createFlatGeometry, FLAT_HOVER_RADIUS, FlatDial } from "./FlatDial";
import { GizmoMenu } from "./GizmoMenu";
import {
    computeSphereRings,
    computeSphereView,
    createSphereGeometry,
    SPHERE_HOVER_RADIUS,
    SphereDial,
    useViewportCameraOrientation,
} from "./SphereDial";
import type {
    RotationGizmoAxes,
    RotationGizmoAxis,
    RotationGizmoLimits,
    RotationGizmoVariant,
    RotationGizmoVisibility,
} from "./types";
import { useCircleHover } from "./useCircleHover";
import { useDialInteraction } from "./useDialInteraction";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export type {
    RotationGizmoAxes,
    RotationGizmoAxis,
    RotationGizmoAxisMode,
    RotationGizmoLimits,
    RotationGizmoVariant,
    RotationGizmoVisibility,
} from "./types";

//------------------------------------------------------------------------------
export type RotationGizmoProps = {
    /**
     * Rotation to display, as `[x, y, z]` angles in degrees. It is meant to be a delta from a rest
     * orientation: each ring draws an arc from its 0° reference mark to the current angle.
     */
    value: Vec3;

    /**
     * Called with the new value while an axis is being edited. Without it, the gizmo is read-only.
     */
    onChange?: (value: Vec3, axis: RotationGizmoAxis) => void;

    /**
     * Called once an edit is committed: when the handle is released, or after a keyboard step.
     */
    onChangeEnd?: (value: Vec3, axis: RotationGizmoAxis) => void;

    /**
     * World position of the pivot of the rotation, e.g. the joint of a bone. The gizmo is centered on it, at
     * a constant size on screen, and must then be rendered inside `DOM3DOverlay`. Without it, the gizmo is
     * rendered where it is placed in the page.
     */
    worldPosition?: Vec3;

    /**
     * World orientation of the rotation axes, e.g. the rest orientation of a bone in world space, so that
     * each ring of the sphere lies in the plane its axis turns in. Defaults to the world axes.
     * Only used by the "default" variant.
     */
    orientation?: Quat;

    /**
     * World orientation of the viewer the sphere is seen from. Defaults to the camera of the viewport the
     * gizmo is rendered in, following it as it moves, or to a three-quarter view from above outside of a
     * viewport. Only used by the "default" variant.
     */
    viewOrientation?: Quat;

    /**
     * "default" draws the rings on a sphere, each one around its own axis as seen from the viewer. "flat"
     * draws them as concentric circles facing the screen. Defaults to "default".
     */
    variant?: RotationGizmoVariant;

    /**
     * Displays every axis in "read" mode, whatever `axes` says. Defaults to false.
     */
    readOnly?: boolean;

    /**
     * Axes to display, with their mode. Axes left out are hidden.
     * Defaults to `{ x: "edit", y: "edit", z: "edit" }`.
     */
    axes?: RotationGizmoAxes;

    /**
     * Allowed `[min, max]` range per axis, in degrees, e.g. the limits of a joint. Edits are clamped to
     * it and the ring highlights it. Defaults to `[-180, 180]`.
     */
    limits?: RotationGizmoLimits;

    /**
     * Increment of the arrow keys, in degrees. Holding Shift multiplies it by 10. Defaults to 1.
     */
    step?: number;

    /**
     * Increment the dragged angle snaps to, in degrees. Holding Shift while dragging snaps to 15°.
     * Defaults to 0 (no snapping).
     */
    snap?: number;

    /**
     * Diameter of the gizmo on screen, in pixels. Defaults to 120.
     */
    size?: number;

    /**
     * Name of the rotated part, e.g. "Head", for assistive technologies.
     */
    label?: string;

    /**
     * Name of each axis, displayed before its value while the gizmo is hovered, e.g. `{ x: "Twist" }`. Also used by assistive
     * technologies, which default to X, Y and Z.
     */
    axisLabels?: Partial<Record<RotationGizmoAxis, string>>;

    /**
     * Color of each axis. Defaults to red, green and blue for x, y and z.
     */
    colors?: Partial<Record<RotationGizmoAxis, string>>;

    /**
     * When to display the angle of each axis next to its handle. With "always", the rotated axes show theirs,
     * and every axis while the gizmo is hovered or edited. With "hover", only while the gizmo is hovered or
     * edited. Defaults to "always".
     */
    showValues?: RotationGizmoVisibility;

    /**
     * When to display the `axisLabels` before the values. Defaults to "hover", to tell the axes apart while
     * editing without cluttering the scene otherwise.
     */
    showAxisLabels?: RotationGizmoVisibility;

    /**
     * Whether to draw the outline of the sphere. Defaults to true. Only used by the "default" variant.
     */
    showSphere?: boolean;

    /**
     * Whether to draw the name of each axis at its tip. Defaults to true. Only used by the "default" variant.
     */
    showPoleLabels?: boolean;

    /**
     * Whether to mark the 0° of each ring. Defaults to true.
     */
    showReferenceMarks?: boolean;

    /**
     * Whether to draw the part of the rings out of `limits`, dotted. Defaults to true.
     */
    showOutOfRange?: boolean;

    /**
     * Whether right-clicking the gizmo, anywhere over its circle, opens a contextual menu to copy its values.
     * Defaults to false.
     */
    showContextMenu?: boolean;

    /**
     * Number of decimal digits of the displayed values. Defaults to 0.
     */
    decimals?: number;

    className?: string;
    style?: React.CSSProperties;
};

//------------------------------------------------------------------------------
const AXES: ReadonlyArray<RotationGizmoAxis> = ["x", "y", "z"];
const DEFAULT_AXES: RotationGizmoAxes = { x: "edit", y: "edit", z: "edit" };
const DEFAULT_LIMITS = [-180, 180] as const;
const DEFAULT_SIZE = 120;
/** World units per pixel and per world unit of distance to the camera, at which `DOM3DAnchor` scales its content. */
const DOM3D_ANCHOR_DISTANCE_SCALE = 0.001;

/**
 * A rotation gizmo, like the ones of 3D editors, displaying a rotation as up to three rings, one per axis:
 * each ring draws an arc from its 0° reference mark to the current angle. Rings in "edit" mode have a handle
 * that can be dragged along the ring or moved with the arrow keys, and double-clicking a ring resets it to 0°.
 * Rings in "read" mode only display the angle.
 *
 * Given a `worldPosition`, the gizmo sits on it in the scene, e.g. on the joint of a bone, at a constant size
 * on screen. By default, the rings are drawn on a sphere, each one around its own axis: given the
 * `orientation` of the axes, e.g. the rest orientation of the bone, and seen from the camera of the viewport,
 * each angle shows in the plane the rotation actually happens in. The "flat" variant draws them as concentric
 * circles facing the screen instead.
 *
 * Only the rings catch the pointer: dragging a handle doesn't move the camera, while dragging anywhere else
 * still does. The gizmo is controlled: it displays `value` and reports edits through `onChange`.
 *
 * Positive angles turn counter-clockwise, as seen from the tip of the axis (right-hand rule).
 *
 * Its look can be themed with the `--rotation-gizmo-*` CSS variables, e.g. `--rotation-gizmo-delta-width` or
 * `--rotation-gizmo-sector-opacity`, set on the gizmo through `style` or on any of its ancestors. They are listed,
 * with their default value, in its stylesheet.
 *
 * @category Components
 *
 * @example
 * ```tsx
 * const [rotation, setRotation] = useState<Vec3>([0, 0, 0]);
 *
 * <DOM3DOverlay>
 *     <RotationGizmo
 *         worldPosition={headJointPosition}
 *         orientation={headRestOrientation}
 *         value={rotation}
 *         onChange={setRotation}
 *         axes={{ x: "edit", z: "edit", y: "read" }}
 *         limits={{ x: [-80, 80], z: [-40, 40] }}
 *     />
 * </DOM3DOverlay>
 * ```
 */
export function RotationGizmo({
    value,
    onChange,
    onChangeEnd,
    worldPosition,
    orientation,
    viewOrientation,
    variant = "default",
    readOnly = false,
    axes = DEFAULT_AXES,
    limits,
    step = 1,
    snap = 0,
    size = DEFAULT_SIZE,
    label,
    axisLabels,
    colors,
    showValues = "always",
    showAxisLabels = "hover",
    showSphere = true,
    showPoleLabels = true,
    showReferenceMarks = true,
    showOutOfRange = true,
    showContextMenu = false,
    decimals = 0,
    className,
    style,
}: RotationGizmoProps): React.JSX.Element {
    const isEditable = !readOnly && onChange !== undefined;
    // Memoized on their content, as callers usually pass new objects and arrays at every render, so that the
    // geometry below is only recomputed when it actually changes.
    const ringsKey = JSON.stringify([axes, limits, colors, isEditable]);
    const rings = useMemo(() => computeRings({ axes, limits, colors, isEditable }), [ringsKey]);

    const isSphere = variant === "default";
    const cameraOrientation = useViewportCameraOrientation(isSphere && !viewOrientation);
    const viewKey = JSON.stringify([orientation, viewOrientation ?? cameraOrientation]);
    const sphereRings = useMemo(
        () =>
            isSphere
                ? computeSphereRings(rings, computeSphereView(orientation, viewOrientation ?? cameraOrientation))
                : null,
        [isSphere, rings, viewKey],
    );
    const geometry = useMemo(
        () => (sphereRings ? createSphereGeometry(rings, sphereRings, value) : createFlatGeometry(rings)),
        [rings, sphereRings, value[0], value[1], value[2]],
    );

    const interaction = useDialInteraction({ value, rings, geometry, snap, step, decimals, onChange, onChangeEnd });

    //--------------------------------------------------------------------------
    const axisNames = { x: "X", y: "Y", z: "Z", ...axisLabels };
    // Hovered while the pointer is anywhere over its circle, not only over a ring, so that it doesn't flicker
    // while moving between rings, and while its menu is open.
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const isCircleHovered = useCircleHover(interaction.svg, isSphere ? SPHERE_HOVER_RADIUS : FLAT_HOVER_RADIUS);
    const isGizmoHovered = isCircleHovered || isMenuOpen;
    // Only highlighted when it can be edited, to tell which gizmo is about to be edited when they overlap.
    const hasEditableRing = rings.some(ring => ring.mode === "edit");
    const isGizmoHighlighted = (isGizmoHovered && hasEditableRing) || interaction.activeAxis !== null;
    const parts = {
        sphere: showSphere,
        poleLabels: showPoleLabels,
        referenceMarks: showReferenceMarks,
        outOfRange: showOutOfRange,
    };
    const valueLabelOptions = {
        showValues,
        showAxisLabels,
        decimals,
        axisLabels,
        isGizmoHovered,
    };

    const svgClassName = [
        styles.dial,
        isGizmoHighlighted ? styles.highlighted : undefined,
        interaction.cursor === "dragging" ? styles.dragging : undefined,
        interaction.cursor === "grabbable" ? styles.grabbable : undefined,
    ]
        .filter(Boolean)
        .join(" ");

    const dial = (
        <svg
            ref={interaction.svgRef}
            viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
            width={size}
            height={size}
            className={[svgClassName, "livelink-react-ui-component", className].filter(Boolean).join(" ")}
            style={style}
            role="group"
            aria-label={label ? `${label} rotation` : "Rotation"}
        >
            {sphereRings ? (
                <SphereDial
                    value={value}
                    rings={rings}
                    sphereRings={sphereRings}
                    interaction={interaction}
                    axisNames={axisNames}
                    valueLabelOptions={valueLabelOptions}
                    parts={parts}
                />
            ) : (
                <FlatDial
                    value={value}
                    rings={rings}
                    interaction={interaction}
                    axisNames={axisNames}
                    valueLabelOptions={valueLabelOptions}
                    parts={parts}
                />
            )}
            <circle className={styles.pivot} cx={CENTER} cy={CENTER} r={1.5} />
        </svg>
    );

    const gizmo = showContextMenu ? (
        <>
            {dial}
            <GizmoMenu
                svg={interaction.svg}
                value={value}
                colors={colors}
                decimals={decimals}
                isCircleHovered={isCircleHovered}
                onOpenChange={setIsMenuOpen}
            />
        </>
    ) : (
        dial
    );

    return worldPosition ? <AnchoredGizmo worldPosition={worldPosition}>{gizmo}</AnchoredGizmo> : gizmo;
}

//------------------------------------------------------------------------------
/**
 * Centers the gizmo on its pivot in the scene, at its actual size on screen.
 */
function AnchoredGizmo({
    worldPosition,
    children,
}: React.PropsWithChildren<{ worldPosition: Vec3 }>): React.JSX.Element {
    const pixelRatio = useDOM3DAnchorPixelRatio();

    return (
        // The anchor itself lets the pointer through: only the rings of the gizmo catch it.
        <DOM3DAnchor worldPosition={worldPosition} style={{ pointerEvents: "none" }}>
            <div style={{ display: "flex", scale: String(pixelRatio) }}>{children}</div>
        </DOM3DAnchor>
    );
}

/**
 * `DOM3DAnchor` keeps its content at a constant size on screen, but not at a 1:1 pixel ratio: it depends on
 * the field of view and the height of the viewport. This is the scale bringing it back to 1:1.
 */
function useDOM3DAnchorPixelRatio(): number {
    const { viewport } = useContext(ViewportContext);
    const [pixelRatio, setPixelRatio] = useState(1);

    useEffect(() => {
        if (!viewport) {
            return;
        }

        const updatePixelRatio = (): void => {
            // Same perspective as the one DOM3DOverlay sets up.
            const focalLength = viewport.camera_projection?.clip_from_view_matrix[5] ?? 1 / Math.tan(Math.PI / 6);
            const perspective = (focalLength * viewport.dom_element.clientHeight) / 2;
            setPixelRatio(1 / (DOM3D_ANCHOR_DISTANCE_SCALE * perspective));
        };

        updatePixelRatio();
        const resizeObserver = new ResizeObserver(updatePixelRatio);
        resizeObserver.observe(viewport.dom_element);
        return (): void => resizeObserver.disconnect();
    }, [viewport]);

    return pixelRatio;
}

//------------------------------------------------------------------------------
function computeRings({
    axes,
    limits,
    colors,
    isEditable,
}: {
    axes: RotationGizmoAxes;
    limits?: RotationGizmoLimits;
    colors?: RotationGizmoProps["colors"];
    isEditable: boolean;
}): Array<Ring> {
    return AXES.filter(axis => axes[axis] !== undefined).map(axis => {
        const [min, max] = limits?.[axis] ?? DEFAULT_LIMITS;
        return {
            axis,
            mode: isEditable ? axes[axis]! : "read",
            min: Math.min(min, max),
            max: Math.max(min, max),
            color: colors?.[axis] ?? `var(--rotation-gizmo-color-${axis})`,
        };
    });
}

//------------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { AXIS_INDEX, VIEWBOX_SIZE, type DialGeometry, type DialPoint, type DragMapping, type Ring } from "./dial";
import { clamp, formatAngle, normalizeAngleDeg, snapAngle } from "./math";
import type { RotationGizmoAxis } from "./types";

//------------------------------------------------------------------------------
const SHIFT_SNAP_DEG = 15;
const PAGE_STEP_FACTOR = 10;

//------------------------------------------------------------------------------
export type DialInteraction = {
    /** Callback ref of the dial element. */
    svgRef: (svg: SVGSVGElement | null) => void;
    /** The dial element, once mounted. */
    svg: SVGSVGElement | null;
    /** Axis being dragged or focused. */
    activeAxis: RotationGizmoAxis | null;
    /** Active axis, or the one under the pointer. */
    highlightedAxis: RotationGizmoAxis | null;
    /** Cursor class to set on the dial. */
    cursor: "grabbable" | "dragging" | null;
    /** Props of the handle of an editable ring: keyboard and accessibility. */
    getHandleProps: (ring: Ring, axisName: string) => React.SVGProps<SVGCircleElement>;
};

/** Center of the dial on screen, and the size of a screen pixel in viewBox units. */
type DialFrame = { centerX: number; centerY: number; viewBoxUnitsPerPixel: number };

type DragState = {
    axis: RotationGizmoAxis;
    pointerId: number;
    /**
     * Where the dial was when grabbed. The gizmo can move while dragging, e.g. when anchored to an
     * animated joint, and measuring the pointer against a moving dial would make the angle drift.
     */
    frame: DialFrame;
    mapping: DragMapping;
    lastPointer: DialPoint;
    /** Unsnapped, clamped angle the drag has reached. */
    angleDeg: number;
    lastEmittedValue: Vec3;
};

/**
 * Pointer and keyboard interaction of a dial, whichever way it draws its rings: `geometry` tells which ring
 * is under the pointer and how dragging it changes its angle.
 */
export function useDialInteraction({
    value,
    rings,
    geometry,
    snap,
    step,
    decimals,
    onChange,
    onChangeEnd,
}: {
    value: Vec3;
    rings: ReadonlyArray<Ring>;
    geometry: DialGeometry;
    snap: number;
    step: number;
    decimals: number;
    onChange?: (value: Vec3, axis: RotationGizmoAxis) => void;
    onChangeEnd?: (value: Vec3, axis: RotationGizmoAxis) => void;
}): DialInteraction {
    // Held in state rather than in a ref so that the listeners are attached whenever the element mounts, which
    // isn't on the first render inside DOM3DAnchor: it only renders its content once projected.
    const [svg, setSvg] = useState<SVGSVGElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const [draggedAxis, setDraggedAxis] = useState<RotationGizmoAxis | null>(null);
    const [hoveredAxis, setHoveredAxis] = useState<RotationGizmoAxis | null>(null);
    const [focusedAxis, setFocusedAxis] = useState<RotationGizmoAxis | null>(null);

    // The pointer listeners are native (see below) and registered once, so they read the props from here.
    const latestRef = useRef({ value, rings, geometry, snap, onChange, onChangeEnd });
    latestRef.current = { value, rings, geometry, snap, onChange, onChangeEnd };

    //--------------------------------------------------------------------------
    // Registered natively rather than through React: the camera controller listens to the viewport
    // element, which contains the 3D overlays, and React only dispatches its events once they have
    // bubbled up to the root, so stopping the propagation from a React handler would be too late.
    useEffect(() => {
        if (!svg) {
            return;
        }

        const emit = (axis: RotationGizmoAxis, angleDeg: number, { commit }: { commit: boolean }): Vec3 => {
            const { value, onChange, onChangeEnd } = latestRef.current;
            const nextValue = [...value] as Vec3;
            nextValue[AXIS_INDEX[axis]] = angleDeg;
            onChange?.(nextValue, axis);
            if (commit) {
                onChangeEnd?.(nextValue, axis);
            }
            return nextValue;
        };

        const emitDragged = (drag: DragState, ring: Ring, shiftKey: boolean): void => {
            const snappedAngleDeg = snapAngle(drag.angleDeg, shiftKey ? SHIFT_SNAP_DEG : latestRef.current.snap);
            drag.lastEmittedValue = emit(drag.axis, clamp(snappedAngleDeg, ring.min, ring.max), { commit: false });
        };

        const onPointerDown = (event: PointerEvent): void => {
            if (event.button !== 0 || dragRef.current) {
                return;
            }

            const frame = getDialFrame(svg);
            const pointer = toDialPoint(frame, event);
            const ring = latestRef.current.geometry.hitTest(pointer);
            if (!ring || ring.mode !== "edit") {
                return;
            }

            event.stopPropagation();
            event.preventDefault();
            svg.setPointerCapture(event.pointerId);

            const currentAngleDeg = latestRef.current.value[AXIS_INDEX[ring.axis]];
            const mapping = latestRef.current.geometry.beginDrag(ring, pointer, currentAngleDeg);
            // Jump to the grabbed point, choosing the turn closest to the current angle so that grabbing the
            // handle of an angle beyond ±180° doesn't make it wrap around.
            const angleDeg =
                "angleAt" in mapping
                    ? currentAngleDeg + normalizeAngleDeg(mapping.angleAt(pointer) - currentAngleDeg)
                    : currentAngleDeg;

            const drag: DragState = {
                axis: ring.axis,
                pointerId: event.pointerId,
                frame,
                mapping,
                lastPointer: pointer,
                angleDeg: clamp(angleDeg, ring.min, ring.max),
                lastEmittedValue: latestRef.current.value,
            };
            dragRef.current = drag;
            emitDragged(drag, ring, event.shiftKey);
            setDraggedAxis(ring.axis);
        };

        const onPointerMove = (event: PointerEvent): void => {
            const drag = dragRef.current;
            if (!drag) {
                const pointer = toDialPoint(getDialFrame(svg), event);
                setHoveredAxis(latestRef.current.geometry.hitTest(pointer)?.axis ?? null);
                return;
            }

            const ring = latestRef.current.rings.find(ring => ring.axis === drag.axis);
            if (event.pointerId !== drag.pointerId || !ring) {
                return;
            }

            const pointer = toDialPoint(drag.frame, event);
            const deltaDeg =
                "angleAt" in drag.mapping
                    ? normalizeAngleDeg(drag.mapping.angleAt(pointer) - drag.mapping.angleAt(drag.lastPointer))
                    : drag.mapping.angleDeltaBetween(drag.lastPointer, pointer);
            drag.lastPointer = pointer;
            // Clamping the accumulated angle, rather than only the emitted one, means the handle moves back
            // as soon as the pointer does after having been dragged past a limit.
            drag.angleDeg = clamp(drag.angleDeg + deltaDeg, ring.min, ring.max);
            emitDragged(drag, ring, event.shiftKey);
        };

        const onPointerUp = (event: PointerEvent): void => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) {
                return;
            }

            dragRef.current = null;
            setDraggedAxis(null);
            if (svg.hasPointerCapture(event.pointerId)) {
                svg.releasePointerCapture(event.pointerId);
            }
            latestRef.current.onChangeEnd?.(drag.lastEmittedValue, drag.axis);
        };

        const onPointerLeave = (): void => {
            if (!dragRef.current) {
                setHoveredAxis(null);
            }
        };

        const onDoubleClick = (event: MouseEvent): void => {
            const ring = latestRef.current.geometry.hitTest(toDialPoint(getDialFrame(svg), event));
            if (!ring || ring.mode !== "edit") {
                return;
            }

            // Also keeps the camera controller from treating it as a double-click on the scene.
            event.stopPropagation();
            event.preventDefault();
            emit(ring.axis, clamp(0, ring.min, ring.max), { commit: true });
        };

        svg.addEventListener("pointerdown", onPointerDown);
        svg.addEventListener("pointermove", onPointerMove);
        svg.addEventListener("pointerup", onPointerUp);
        svg.addEventListener("pointercancel", onPointerUp);
        svg.addEventListener("pointerleave", onPointerLeave);
        svg.addEventListener("dblclick", onDoubleClick);

        return (): void => {
            svg.removeEventListener("pointerdown", onPointerDown);
            svg.removeEventListener("pointermove", onPointerMove);
            svg.removeEventListener("pointerup", onPointerUp);
            svg.removeEventListener("pointercancel", onPointerUp);
            svg.removeEventListener("pointerleave", onPointerLeave);
            svg.removeEventListener("dblclick", onDoubleClick);
        };
    }, [svg]);

    //--------------------------------------------------------------------------
    const onHandleKeyDown = (event: React.KeyboardEvent, ring: Ring): void => {
        const currentAngleDeg = value[AXIS_INDEX[ring.axis]];
        const keyStep = event.shiftKey ? step * PAGE_STEP_FACTOR : step;

        let angleDeg: number;
        switch (event.key) {
            case "ArrowUp":
            case "ArrowRight":
                angleDeg = currentAngleDeg + keyStep;
                break;
            case "ArrowDown":
            case "ArrowLeft":
                angleDeg = currentAngleDeg - keyStep;
                break;
            case "PageUp":
                angleDeg = currentAngleDeg + step * PAGE_STEP_FACTOR;
                break;
            case "PageDown":
                angleDeg = currentAngleDeg - step * PAGE_STEP_FACTOR;
                break;
            case "Home":
                angleDeg = ring.min;
                break;
            case "End":
                angleDeg = ring.max;
                break;
            default:
                return;
        }

        // Keeps the keys from also reaching the camera controller.
        event.preventDefault();
        event.stopPropagation();

        const nextValue = [...value] as Vec3;
        nextValue[AXIS_INDEX[ring.axis]] = clamp(angleDeg, ring.min, ring.max);
        onChange?.(nextValue, ring.axis);
        onChangeEnd?.(nextValue, ring.axis);
    };

    const getHandleProps = (ring: Ring, axisName: string): React.SVGProps<SVGCircleElement> => {
        const angleDeg = value[AXIS_INDEX[ring.axis]];
        return {
            tabIndex: 0,
            role: "slider",
            "aria-label": `${axisName} rotation`,
            "aria-valuemin": ring.min,
            "aria-valuemax": ring.max,
            "aria-valuenow": angleDeg,
            "aria-valuetext": formatAngle(angleDeg, decimals),
            onKeyDown: event => onHandleKeyDown(event, ring),
            onFocus: () => setFocusedAxis(ring.axis),
            onBlur: () => setFocusedAxis(null),
        };
    };

    //--------------------------------------------------------------------------
    const activeAxis = draggedAxis ?? focusedAxis;
    return {
        svgRef: setSvg,
        svg,
        activeAxis,
        highlightedAxis: activeAxis ?? hoveredAxis,
        cursor: draggedAxis ? "dragging" : hoveredAxis ? "grabbable" : null,
        getHandleProps,
    };
}

//------------------------------------------------------------------------------
/**
 * Relies on the bounding rect, so it holds as long as the gizmo faces the screen, which is the case of
 * `DOM3DAnchor` billboards.
 */
function getDialFrame(svg: SVGSVGElement): DialFrame {
    const rect = svg.getBoundingClientRect();
    return {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        viewBoxUnitsPerPixel: VIEWBOX_SIZE / rect.width,
    };
}

function toDialPoint(frame: DialFrame, event: MouseEvent): DialPoint {
    return {
        x: (event.clientX - frame.centerX) * frame.viewBoxUnitsPerPixel,
        y: (event.clientY - frame.centerY) * frame.viewBoxUnitsPerPixel,
    };
}

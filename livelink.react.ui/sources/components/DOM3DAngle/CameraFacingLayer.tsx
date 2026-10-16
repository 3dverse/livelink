//------------------------------------------------------------------------------
import React from "react";
import type { Vec3 } from "@3dverse/livelink";
import { DOM3DDiv } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { rotateVec3 } from "../RotationGizmo/math";
import type { ViewportCamera } from "./useViewportCamera";
import { add, cross, dot, length, normalize, scale, subtract } from "./vector";
import type { Point } from "./geometry";

//------------------------------------------------------------------------------
const WORLD_UP: Vec3 = [0, 1, 0];

/**
 * The layer lies at this ratio of the distance from the camera to its anchor. `DOM3DOverlay` sorts its elements by
 * depth: halfway to the camera, it is drawn over what lies around its anchor, e.g. the gauge, whose half nearer the
 * camera would otherwise hide it.
 */
const PLANE_DISTANCE_RATIO = 0.5;

/** Projects a world position to the layer, in pixels from its anchor, x right and y down. Null behind the camera. */
export type Projector = (worldPosition: Vec3) => Point | null;

/**
 * Draws on a plane facing the camera, between it and `anchor`, in screen pixels. World positions are projected on
 * it along the lines of sight, so that what is drawn lies exactly where it is seen, over what lies around `anchor`,
 * with strokes of the same width whatever the distance, and reads from any side: for lines that must stay visible
 * when the plane of the gauge is seen edge-on.
 * @internal
 */
export function CameraFacingLayer({
    anchor,
    viewportCamera,
    extent,
    marginPx,
    className,
    style,
    children,
}: {
    anchor: Vec3;
    viewportCamera: ViewportCamera;
    /** World positions the layer must cover. */
    extent: ReadonlyArray<Vec3>;
    /** Room left around `extent`, in pixels, e.g. for labels. */
    marginPx: number;
    className?: string;
    style?: React.CSSProperties;
    children: (project: Projector) => React.ReactNode;
}): React.JSX.Element | null {
    const view = createView(anchor, viewportCamera);
    if (!view) {
        return null;
    }

    const projected = extent.map(view.project).filter((point): point is Point => point !== null);
    const halfWidthPx = Math.max(0, ...projected.map(point => Math.abs(point.x))) + marginPx;
    const halfHeightPx = Math.max(0, ...projected.map(point => Math.abs(point.y))) + marginPx;

    const at = (rightPx: number, upPx: number): Vec3 =>
        add(
            view.center,
            add(scale(view.right, rightPx / view.pixelsPerUnit), scale(view.up, upPx / view.pixelsPerUnit)),
        );

    return (
        <DOM3DDiv
            worldQuad={[
                at(-halfWidthPx, halfHeightPx),
                at(halfWidthPx, halfHeightPx),
                at(halfWidthPx, -halfHeightPx),
                at(-halfWidthPx, -halfHeightPx),
            ]}
            worldUnitToPixelScale={view.pixelsPerUnit}
            className={className}
            style={{ ...style, pointerEvents: "none" }}
        >
            <svg
                viewBox={`${-halfWidthPx} ${-halfHeightPx} ${2 * halfWidthPx} ${2 * halfHeightPx}`}
                width="100%"
                height="100%"
                style={{ display: "block", overflow: "visible" }}
                aria-hidden
            >
                {children(view.project)}
            </svg>
        </DOM3DDiv>
    );
}

//------------------------------------------------------------------------------
/**
 * The plane perpendicular to the line of sight of `anchor`, between the camera and it, its center, on that line of
 * sight, its axes, right and up on screen, and the projection on it. Points projected along their line of sight are
 * seen where they are, wherever the plane is.
 */
function createView(
    anchor: Vec3,
    viewportCamera: ViewportCamera,
): { center: Vec3; right: Vec3; up: Vec3; pixelsPerUnit: number; project: Projector } | null {
    const toAnchor = subtract(anchor, viewportCamera.position);
    const anchorDistance = length(toAnchor);
    if (anchorDistance === 0) {
        return null;
    }

    const lineOfSight = scale(toAnchor, 1 / anchorDistance);
    const distance = anchorDistance * PLANE_DISTANCE_RATIO;
    const toCenter = scale(lineOfSight, distance);
    // Looking straight up or down, the right of the camera is the only right there is.
    const horizontalRight = cross(lineOfSight, WORLD_UP);
    const right =
        length(horizontalRight) > 1e-6 ? normalize(horizontalRight) : rotateVec3(viewportCamera.orientation, [1, 0, 0]);
    const up = cross(right, lineOfSight);
    const pixelsPerUnit = viewportCamera.focalLengthPx / distance;

    const project: Projector = worldPosition => {
        const toPoint = subtract(worldPosition, viewportCamera.position);
        const depth = dot(toPoint, lineOfSight);
        if (depth <= 1e-6) {
            return null;
        }
        const onPlane = subtract(scale(toPoint, distance / depth), toCenter);
        return { x: dot(onPlane, right) * pixelsPerUnit, y: -dot(onPlane, up) * pixelsPerUnit };
    };

    return { center: add(viewportCamera.position, toCenter), right, up, pixelsPerUnit, project };
}

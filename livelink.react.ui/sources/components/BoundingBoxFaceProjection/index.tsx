//------------------------------------------------------------------------------
import React, { PropsWithChildren, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Mat4, Vec3 } from "@3dverse/livelink";
import { DOM3DDiv } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
export type Face = "front" | "back" | "left" | "right" | "top" | "bottom";

//------------------------------------------------------------------------------
export type Quad = [Vec3, Vec3, Vec3, Vec3];

//------------------------------------------------------------------------------
export const BoundingBoxFaceProjection = ({
    entity,
    face,
    scale = 100,
    invert = false,
    children,
    ...props
}: PropsWithChildren<{
    entity: Entity | null;
    face: Face;
    scale?: number;
    invert?: boolean;
}> &
    React.HTMLAttributes<HTMLDivElement> &
    React.DOMAttributes<HTMLDivElement>) => {
    const [wsQuad, setWsQuad] = useState<Quad | null>(
        entity ? computeWorldSpaceQuad({ entity, face, invert }).wsQuad : null,
    );

    useEffect(() => {
        if (!entity) {
            return;
        }

        const updateQuad = (): void => setWsQuad(computeWorldSpaceQuad({ entity, face, invert }).wsQuad);
        updateQuad();

        // global_transform (ls_to_ws) depends on every ancestor's transform too.
        const abortController = new AbortController();
        for (let node: Entity | null = entity; node; node = node.parent) {
            node.addEventListener("on-entity-updated", updateQuad, { signal: abortController.signal });
        }

        return (): void => {
            abortController.abort();
        };
    }, [entity, face, invert]);

    if (!entity || !wsQuad) {
        return null;
    }

    return (
        <DOM3DDiv worldQuad={wsQuad} worldUnitToPixelScale={scale} {...props}>
            {children}
        </DOM3DDiv>
    );
};

/**
 * Computes the 4 corner points of the specified face of the entity's bounding box.
 * The points are returned in the order: top-left, top-right, bottom-right, bottom-left.
 * This follows how the CSS quad is defined, where the first point is the origin (0,0) in the top-left corner
 * and the others are ordered clockwise.
 *
 * The `invert` option can be used to flip the order of the points, which is useful to project the back face of the
 * bounding box, as it would be defined in a counter-clockwise order.
 *
 *     TL O------>------+ TR                       TL +------<------O TR
 *        |             |                             |             |
 *        |             |                             |             |
 *        |             v              invert ->      v             |
 *        |             |                             |             |
 *        |             |                             |             |
 *     BL +------<------+ BR                       BL +------>------+ BR
 *
 * Unlike `entity.global_aabb` (axis-aligned in world space), corners are computed from the local
 * bounding box and transformed by `entity.ls_to_ws`, giving an oriented quad.
 *
 * The way dimensions of the face (width and height) are computed depends on the face:
 * - For "front" and "back", width is the difference in x coordinates and height is the difference in y coordinates.
 * - For "left" and "right", width is the difference in z coordinates and height is the difference in y coordinates.
 * - For "top" and "bottom", width is the difference in x coordinates and height is the difference in z coordinates.
 */
function computeWorldSpaceQuad({ entity, face, invert }: { entity: Entity; face: Face; invert?: boolean }): {
    wsQuad: Quad;
    width: number;
    height: number;
} {
    const local_aabb = entity.local_aabb ?? { min: [-1, -1, -1] as Vec3, max: [1, 1, 1] as Vec3 };
    const { min, max } = local_aabb;
    const ls_to_ws = entity.ls_to_ws as Mat4;

    const leftBottomBack = transformPoint([min[0], min[1], min[2]], ls_to_ws);
    const leftBottomFront = transformPoint([min[0], min[1], max[2]], ls_to_ws);
    const rightBottomBack = transformPoint([max[0], min[1], min[2]], ls_to_ws);
    const rightBottomFront = transformPoint([max[0], min[1], max[2]], ls_to_ws);

    const leftTopBack = transformPoint([min[0], max[1], min[2]], ls_to_ws);
    const leftTopFront = transformPoint([min[0], max[1], max[2]], ls_to_ws);
    const rightTopBack = transformPoint([max[0], max[1], min[2]], ls_to_ws);
    const rightTopFront = transformPoint([max[0], max[1], max[2]], ls_to_ws);

    switch (face) {
        case "front":
            return {
                wsQuad: invert
                    ? [rightTopFront, leftTopFront, leftBottomFront, rightBottomFront]
                    : [leftTopFront, rightTopFront, rightBottomFront, leftBottomFront],
                width: distance(leftTopFront, rightTopFront),
                height: distance(leftTopFront, leftBottomFront),
            };
        case "back":
            return {
                wsQuad: invert
                    ? [leftTopBack, rightTopBack, rightBottomBack, leftBottomBack]
                    : [rightTopBack, leftTopBack, leftBottomBack, rightBottomBack],
                width: distance(leftTopBack, rightTopBack),
                height: distance(leftTopBack, leftBottomBack),
            };
        case "top":
            return {
                wsQuad: invert
                    ? [rightTopBack, leftTopBack, leftTopFront, rightTopFront]
                    : [leftTopBack, rightTopBack, rightTopFront, leftTopFront],
                width: distance(leftTopBack, rightTopBack),
                height: distance(leftTopBack, leftTopFront),
            };
        case "bottom":
            return {
                wsQuad: invert
                    ? [leftBottomBack, rightBottomBack, rightBottomFront, leftBottomFront]
                    : [rightBottomBack, leftBottomBack, leftBottomFront, rightBottomFront],
                width: distance(leftBottomBack, rightBottomBack),
                height: distance(leftBottomBack, leftBottomFront),
            };
        case "left":
            return {
                wsQuad: invert
                    ? [leftTopFront, leftTopBack, leftBottomBack, leftBottomFront]
                    : [leftTopBack, leftTopFront, leftBottomFront, leftBottomBack],
                width: distance(leftTopBack, leftTopFront),
                height: distance(leftTopBack, leftBottomBack),
            };
        case "right":
            return {
                wsQuad: invert
                    ? [rightTopBack, rightTopFront, rightBottomFront, rightBottomBack]
                    : [rightTopFront, rightTopBack, rightBottomBack, rightBottomFront],
                width: distance(rightTopBack, rightTopFront),
                height: distance(rightTopBack, rightBottomBack),
            };
    }
}

/** Transforms a point by a column-major 4x4 matrix, mirroring gl-matrix's `vec3.transformMat4`. */
function transformPoint(point: Vec3, m: Mat4): Vec3 {
    const [x, y, z] = point;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [
        (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
        (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
        (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
    ];
}

function distance(a: Vec3, b: Vec3): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

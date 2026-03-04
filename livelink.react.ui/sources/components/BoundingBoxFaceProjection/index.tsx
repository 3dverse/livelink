//------------------------------------------------------------------------------
import React, { PropsWithChildren } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";
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
    if (!entity) {
        return null;
    }

    const { wsQuad } = computeWorldSpaceQuad({
        entity: entity!,
        face,
        invert,
    });

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
    const min = entity.global_aabb.min;
    const max = entity.global_aabb.max;

    const leftBottomBack: Vec3 = [min[0], min[1], min[2]];
    const leftBottomFront: Vec3 = [min[0], min[1], max[2]];
    const rightBottomBack: Vec3 = [max[0], min[1], min[2]];
    const rightBottomFront: Vec3 = [max[0], min[1], max[2]];

    const leftTopBack: Vec3 = [min[0], max[1], min[2]];
    const leftTopFront: Vec3 = [min[0], max[1], max[2]];
    const rightTopBack: Vec3 = [max[0], max[1], min[2]];
    const rightTopFront: Vec3 = [max[0], max[1], max[2]];

    switch (face) {
        case "front":
            return {
                wsQuad: invert
                    ? [rightTopFront, leftTopFront, leftBottomFront, rightBottomFront]
                    : [leftTopFront, rightTopFront, rightBottomFront, leftBottomFront],
                width: Math.abs(max[0] - min[0]),
                height: Math.abs(max[1] - min[1]),
            };
        case "back":
            return {
                wsQuad: invert
                    ? [leftTopBack, rightTopBack, rightBottomBack, leftBottomBack]
                    : [rightTopBack, leftTopBack, leftBottomBack, rightBottomBack],
                width: Math.abs(max[0] - min[0]),
                height: Math.abs(max[1] - min[1]),
            };
        case "top":
            return {
                wsQuad: invert
                    ? [rightTopBack, leftTopBack, leftTopFront, rightTopFront]
                    : [leftTopBack, rightTopBack, rightTopFront, leftTopFront],
                width: Math.abs(max[0] - min[0]),
                height: Math.abs(max[2] - min[2]),
            };
        case "bottom":
            return {
                wsQuad: invert
                    ? [leftBottomBack, rightBottomBack, rightBottomFront, leftBottomFront]
                    : [rightBottomBack, leftBottomBack, leftBottomFront, rightBottomFront],
                width: Math.abs(max[0] - min[0]),
                height: Math.abs(max[2] - min[2]),
            };
        case "left":
            return {
                wsQuad: invert
                    ? [leftTopFront, leftTopBack, leftBottomBack, leftBottomFront]
                    : [leftTopBack, leftTopFront, leftBottomFront, leftBottomBack],
                width: Math.abs(max[2] - min[2]),
                height: Math.abs(max[1] - min[1]),
            };
        case "right":
            return {
                wsQuad: invert
                    ? [rightTopBack, rightTopFront, rightBottomFront, rightBottomBack]
                    : [rightTopFront, rightTopBack, rightBottomBack, rightBottomFront],
                width: Math.abs(max[2] - min[2]),
                height: Math.abs(max[1] - min[1]),
            };
    }
}

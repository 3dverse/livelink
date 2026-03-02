//------------------------------------------------------------------------------
import { Mat4, Vec3, Viewport } from "@3dverse/livelink";
import { epsilon } from "../components/utils/math";

/**
 *
 */
export type PointProjection = {
    screen_position: Vec3;
    is_visible: boolean;
};

/**
 * @internal
 */
export abstract class DOM3DElementProjection {
    /**
     * Updates the projection of the element. Called by the overlay on each frame.
     */
    abstract updateProjection({ viewport }: { viewport: Viewport }): void;
}

/**
 * Converts a 4x4 transformation matrix into a CSS matrix3d string, with optional translation offsets.
 */
export function getObjectCSSMatrix(elements: Mat4, translateX: number = -50, translateY: number = -50): string {
    return (
        `translate(${translateX}%,${translateY}%) matrix3d(` +
        epsilon(elements[0]) +
        "," +
        epsilon(elements[1]) +
        "," +
        epsilon(elements[2]) +
        "," +
        epsilon(elements[3]) +
        "," +
        epsilon(-elements[4]) +
        "," +
        epsilon(-elements[5]) +
        "," +
        epsilon(-elements[6]) +
        "," +
        epsilon(-elements[7]) +
        "," +
        epsilon(elements[8]) +
        "," +
        epsilon(elements[9]) +
        "," +
        epsilon(elements[10]) +
        "," +
        epsilon(elements[11]) +
        "," +
        epsilon(elements[12]) +
        "," +
        epsilon(elements[13]) +
        "," +
        epsilon(elements[14]) +
        "," +
        epsilon(elements[15]) +
        ")"
    );
}

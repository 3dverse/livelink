//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const RAD_TO_DEG = 180 / Math.PI;

export function add([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
    return [ax + bx, ay + by, az + bz];
}

export function subtract([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
    return [ax - bx, ay - by, az - bz];
}

export function scale([x, y, z]: Vec3, factor: number): Vec3 {
    return [x * factor, y * factor, z * factor];
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
    return scale(add(a, b), 0.5);
}

export function dot([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): number {
    return ax * bx + ay * by + az * bz;
}

export function cross([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
    return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

export function length(vector: Vec3): number {
    return Math.sqrt(dot(vector, vector));
}

/** Unit vector, or the zero vector when `vector` is. */
export function normalize(vector: Vec3): Vec3 {
    const vectorLength = length(vector);
    return vectorLength > 0 ? scale(vector, 1 / vectorLength) : [0, 0, 0];
}

/** Part of `vector` perpendicular to the unit vector `axis`. */
export function reject(vector: Vec3, axis: Vec3): Vec3 {
    return subtract(vector, scale(axis, dot(vector, axis)));
}

/** Unsigned angle between two vectors, in degrees. */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
    const lengths = length(a) * length(b);
    return lengths > 0 ? Math.acos(Math.min(1, Math.max(-1, dot(a, b) / lengths))) * RAD_TO_DEG : 0;
}

/** Angle turning `from` to `to` around the unit vector `axis`, right-handed, in degrees. */
export function signedAngleDeg(from: Vec3, to: Vec3, axis: Vec3): number {
    return Math.atan2(dot(cross(from, to), axis), dot(from, to)) * RAD_TO_DEG;
}

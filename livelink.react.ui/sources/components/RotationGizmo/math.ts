//------------------------------------------------------------------------------
import type { Quat, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const DEG_TO_RAD = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Angle normalized to [-180, 180). */
export function normalizeAngleDeg(angleDeg: number): number {
    return ((((angleDeg + 180) % 360) + 360) % 360) - 180;
}

export function snapAngle(angleDeg: number, increment: number): number {
    return increment > 0 ? Math.round(angleDeg / increment) * increment : angleDeg;
}

/** Angle with a true minus sign when negative, e.g. "12°" or "−8°". */
export function formatAngle(angleDeg: number, decimals: number): string {
    const rounded = Number(angleDeg.toFixed(decimals));
    if (rounded === 0) {
        return `${(0).toFixed(decimals)}°`;
    }
    return `${rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(decimals)}°`;
}

//------------------------------------------------------------------------------
// Quaternions are [x, y, z, w], as in Livelink.

export function multiplyQuat([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat {
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ];
}

/** Inverse of a unit quaternion. */
export function conjugateQuat([x, y, z, w]: Quat): Quat {
    return [-x, -y, -z, w];
}

export function axisAngleToQuat([ax, ay, az]: Vec3, angleDeg: number): Quat {
    const halfAngleRad = (angleDeg * DEG_TO_RAD) / 2;
    const sin = Math.sin(halfAngleRad);
    return [ax * sin, ay * sin, az * sin, Math.cos(halfAngleRad)];
}

export function rotateVec3([qx, qy, qz, qw]: Quat, [vx, vy, vz]: Vec3): Vec3 {
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return [vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx];
}

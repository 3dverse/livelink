import { copySign } from ".";
import type { Quat, Vec3 } from "@3dverse/livelink.core";

/**
 *
 */
export function quaternionToEuler([x, y, z, w]: Quat): Vec3 {
    const euler = { roll: 0.0, pitch: 0.0, yaw: 0.0 };
    const q = { x, y, z, w };

    // roll (x-axis rotation)
    let sinr_cosp = +2.0 * (q.w * q.x + q.y * q.z);
    let cosr_cosp = +1.0 - 2.0 * (q.x * q.x + q.y * q.y);
    euler.roll = Math.atan2(sinr_cosp, cosr_cosp);

    // pitch (y-axis rotation)
    let sinp = +2.0 * (q.w * q.y - q.z * q.x);
    if (Math.abs(sinp) >= 1) {
        euler.pitch = copySign(Math.PI / 2, sinp); // use 90 degrees if out of range: ;
    } else {
        euler.pitch = Math.asin(sinp);
    }

    // yaw (z-axis rotation)
    let siny_cosp = +2.0 * (q.w * q.z + q.x * q.y);
    let cosy_cosp = +1.0 - 2.0 * (q.y * q.y + q.z * q.z);
    euler.yaw = Math.atan2(siny_cosp, cosy_cosp);

    return [euler.roll, euler.pitch, euler.yaw].map(radian => (radian * 180.0) / Math.PI) as Vec3;
}

/**
 *
 */
export function quaternionFromEuler(eulers: Vec3): Quat {
    const [roll, pitch, yaw] = eulers.map(degree => (degree * Math.PI) / 180.0);

    const cy = Math.cos(yaw / 2);
    const sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2);
    const sp = Math.sin(pitch / 2);
    const cr = Math.cos(roll / 2);
    const sr = Math.sin(roll / 2);

    return [
        cy * cp * sr - sy * sp * cr,
        sy * cp * sr + cy * sp * cr,
        sy * cp * cr - cy * sp * sr,
        cy * cp * cr + sy * sp * sr,
    ];
}

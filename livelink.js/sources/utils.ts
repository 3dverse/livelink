import { Mat4, Quat } from "@3dverse/livelink.core";

export const getWorldPosition = (worldMatrix: Mat4): [number, number, number] => {
    return [worldMatrix[12], worldMatrix[13], worldMatrix[14]];
};

export const getWorldQuaternion = (worldMatrix: Mat4): Quat => {
    const quaternion = [0, 0, 0, 0];
    const m11 = worldMatrix[0];
    const m12 = worldMatrix[1];
    const m13 = worldMatrix[2];

    const m21 = worldMatrix[4];
    const m22 = worldMatrix[5];
    const m23 = worldMatrix[6];

    const m31 = worldMatrix[8];
    const m32 = worldMatrix[9];
    const m33 = worldMatrix[10];

    const trace = m11 + m22 + m33;

    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1.0);
        quaternion[3] = 0.25 / s;
        quaternion[0] = (m23 - m32) * s;
        quaternion[1] = (m31 - m13) * s;
        quaternion[2] = (m12 - m21) * s;
    } else if (m11 > m22 && m11 > m33) {
        const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
        quaternion[3] = (m23 - m32) / s;
        quaternion[0] = 0.25 * s;
        quaternion[1] = (m12 + m21) / s;
        quaternion[2] = (m13 + m31) / s;
    } else if (m22 > m33) {
        const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
        quaternion[3] = (m31 - m13) / s;
        quaternion[0] = (m12 + m21) / s;
        quaternion[1] = 0.25 * s;
        quaternion[2] = (m23 + m32) / s;
    } else {
        const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
        quaternion[3] = (m12 - m21) / s;
        quaternion[0] = (m13 + m31) / s;
        quaternion[1] = (m23 + m32) / s;
        quaternion[2] = 0.25 * s;
    }

    return quaternion as Quat;
};

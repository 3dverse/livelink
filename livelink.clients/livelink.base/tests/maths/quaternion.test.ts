import { describe, expect, it } from "vitest";
import type { Quat, Vec3 } from "@3dverse/livelink.core";
import { quaternionFromEuler, quaternionToEuler, copySign } from "../../sources/maths";

const SQRT1_2 = Math.SQRT1_2; // sin/cos of 45° = √2/2

function expectVec3(actual: Vec3, expected: Vec3, precision = 5): void {
    expect(actual[0]).toBeCloseTo(expected[0], precision);
    expect(actual[1]).toBeCloseTo(expected[1], precision);
    expect(actual[2]).toBeCloseTo(expected[2], precision);
}

function expectQuat(actual: Quat, expected: Quat, precision = 5): void {
    expect(actual[0]).toBeCloseTo(expected[0], precision);
    expect(actual[1]).toBeCloseTo(expected[1], precision);
    expect(actual[2]).toBeCloseTo(expected[2], precision);
    expect(actual[3]).toBeCloseTo(expected[3], precision);
}

// ---------------------------------------------------------------------------

describe("quaternionFromEuler", () => {
    it("zero euler angles produce identity quaternion", () => {
        expectQuat(quaternionFromEuler([0, 0, 0]), [0, 0, 0, 1]);
    });

    it("90° roll (x-axis rotation)", () => {
        expectQuat(quaternionFromEuler([90, 0, 0]), [SQRT1_2, 0, 0, SQRT1_2]);
    });

    it("90° pitch (y-axis rotation)", () => {
        expectQuat(quaternionFromEuler([0, 90, 0]), [0, SQRT1_2, 0, SQRT1_2]);
    });

    it("90° yaw (z-axis rotation)", () => {
        expectQuat(quaternionFromEuler([0, 0, 90]), [0, 0, SQRT1_2, SQRT1_2]);
    });

    it("180° roll produces correct quaternion", () => {
        expectQuat(quaternionFromEuler([180, 0, 0]), [1, 0, 0, 0]);
    });
});

// ---------------------------------------------------------------------------

describe("quaternionToEuler", () => {
    it("identity quaternion produces zero euler angles", () => {
        expectVec3(quaternionToEuler([0, 0, 0, 1]), [0, 0, 0]);
    });

    it("90° roll quaternion produces [90, 0, 0]", () => {
        expectVec3(quaternionToEuler([SQRT1_2, 0, 0, SQRT1_2]), [90, 0, 0]);
    });

    it("90° pitch quaternion clamps pitch to 90° (gimbal lock — roll and yaw are indeterminate)", () => {
        // At pitch = ±90°, roll and yaw axes align. Math.SQRT1_2² is not exactly 0.5 in
        // IEEE 754, so cosr_cosp and cosy_cosp become -epsilon, driving atan2(0, -epsilon)
        // to π. The resulting [180, 90, 180] is an equivalent representation of [0, 90, 0].
        const [roll, pitch, yaw] = quaternionToEuler([0, SQRT1_2, 0, SQRT1_2]);
        expect(pitch).toBeCloseTo(90);
        // Roll + yaw absorb the gimbal lock ambiguity; their sum is what matters.
        expect(roll + yaw).toBeCloseTo(360);
    });

    it("90° yaw quaternion produces [0, 0, 90]", () => {
        expectVec3(quaternionToEuler([0, 0, SQRT1_2, SQRT1_2]), [0, 0, 90]);
    });
});

// ---------------------------------------------------------------------------

describe("round-trip", () => {
    it("euler → quat → euler is identity for arbitrary angles", () => {
        const angles: Vec3[] = [
            [30, 45, 60],
            [-30, 20, -10],
            // [0, 90, 0] omitted — gimbal lock makes the round-trip ambiguous
            [45, 0, 45],
        ];

        for (const euler of angles) {
            const result = quaternionToEuler(quaternionFromEuler(euler));
            expectVec3(result, euler, 4);
        }
    });

    it("quat → euler → quat is identity for canonical quaternions", () => {
        const quats: Quat[] = [
            [0, 0, 0, 1],
            [SQRT1_2, 0, 0, SQRT1_2],
            [0, SQRT1_2, 0, SQRT1_2],
            [0, 0, SQRT1_2, SQRT1_2],
        ];

        for (const q of quats) {
            const result = quaternionFromEuler(quaternionToEuler(q));
            expectQuat(result, q, 4);
        }
    });
});

// ---------------------------------------------------------------------------

describe("copySign", () => {
    it("returns positive magnitude when sign source is positive", () => {
        expect(copySign(5, 1)).toBe(5);
    });

    it("returns negative magnitude when sign source is negative", () => {
        expect(copySign(5, -1)).toBe(-5);
    });

    it("flips sign of a negative magnitude to positive", () => {
        expect(copySign(-5, 1)).toBe(5);
    });

    it("keeps magnitude negative when sign source is negative", () => {
        expect(copySign(-5, -1)).toBe(-5);
    });
});

import { Vec3, Quat } from "@3dverse/livelink";

/**
 *
 */
export type JointIndex = number;

/**
 *
 */
export type JointParents = Array<JointIndex>;

/**
 *
 */
export type AnimationFrame = {
    positions?: Array<Vec3>;
    rotations: Array<Quat>;
};

/**
 *
 */
export type Animation = Array<AnimationFrame>;

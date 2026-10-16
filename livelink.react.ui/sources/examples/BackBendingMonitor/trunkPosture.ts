//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import {
    RAD_TO_DEG,
    angleBetweenDeg,
    cross,
    dot,
    length,
    midpoint,
    normalize,
    reject,
    signedAngleDeg,
    subtract,
} from "../../components/DOM3DAngleAlert/vector";
import type { BodyLandmarks } from "./bodyRig";

//------------------------------------------------------------------------------
const WORLD_UP: Vec3 = [0, 1, 0];

/**
 * Angles of the trunk, in degrees, measured from the landmarks of a body capture, as an ergonomist would measure
 * them on a video, relative to the upright standing posture of the person.
 */
export type TrunkPosture = {
    /**
     * Angle of the trunk line, from the hip joint center to the base of the neck (C7), from the vertical, in the
     * sagittal plane, + forward. The angle EN 1005-4 and ISO 11226 assess: it is what loads the lower back, the
     * trunk being held against gravity, whether it bends at the hips or in the spine.
     */
    trunkInclinationDeg: number;
    /**
     * Bend of the lower back, between the pelvis, from the hip joint center to the base of the spine, and the
     * segment of the spine above the waist, + forward: how much of the inclination comes from rounding the lower
     * back rather than tilting the pelvis at the hips.
     */
    lumbarFlexionDeg: number;
    /**
     * Bend of the upper back, between the segment of the spine below the chest and the one above it, up to the base
     * of the neck, + forward: hunching.
     */
    thoracicFlexionDeg: number;
    /** Mean bend of both knees, 0 for straight legs. */
    kneeFlexionDeg: number;
    /** Turn of the shoulders relative to the pelvis, around the trunk, + to the left. */
    twistDeg: number;
    /** Inclination of the trunk line out of the sagittal plane, + to the left. */
    lateralBendDeg: number;

    /** Hip joint center, the vertex of the trunk inclination. */
    hipCenter: Vec3;
    /** Horizontal axis toward the left of the pelvis: the axis of forward bends. */
    lateralAxis: Vec3;
    /** Distance from the hip joint center to the base of the neck. */
    trunkLength: number;
};

/**
 * Measures the angles of the trunk. Pass the measure of the upright standing posture of the person as `neutral` to
 * get the angles relative to it, as motion capture systems calibrate on a neutral pose: the landmarks of the
 * spine aren't aligned at rest, and differ from one person to the next.
 */
export function measureTrunkPosture(landmarks: BodyLandmarks, neutral?: TrunkPosture): TrunkPosture {
    const hipCenter = midpoint(landmarks.leftHip, landmarks.rightHip);
    const lateralAxis = normalize(reject(subtract(landmarks.leftHip, landmarks.rightHip), WORLD_UP));
    const forwardAxis = cross(lateralAxis, WORLD_UP);

    /** Angle of a segment from the vertical, projected on the sagittal plane, + forward. */
    const sagittalAngleDeg = (segment: Vec3): number =>
        Math.atan2(dot(segment, forwardAxis), dot(segment, WORLD_UP)) * RAD_TO_DEG;

    const trunk = subtract(landmarks.neckBase, hipCenter);
    const trunkAxis = normalize(trunk);
    const pelvisSegment = subtract(landmarks.spineBase, hipCenter);
    const lowerThoracicSegment = subtract(landmarks.chest, landmarks.waist);
    const upperThoracicSegment = subtract(landmarks.neckBase, landmarks.chest);

    const hipLine = reject(subtract(landmarks.leftHip, landmarks.rightHip), trunkAxis);
    const shoulderLine = reject(subtract(landmarks.leftShoulder, landmarks.rightShoulder), trunkAxis);

    const kneeFlexionDeg =
        (angleBetweenDeg(
            subtract(landmarks.leftKnee, landmarks.leftHip),
            subtract(landmarks.leftAnkle, landmarks.leftKnee),
        ) +
            angleBetweenDeg(
                subtract(landmarks.rightKnee, landmarks.rightHip),
                subtract(landmarks.rightAnkle, landmarks.rightKnee),
            )) /
        2;

    return {
        trunkInclinationDeg: sagittalAngleDeg(trunk) - (neutral?.trunkInclinationDeg ?? 0),
        lumbarFlexionDeg:
            sagittalAngleDeg(lowerThoracicSegment) - sagittalAngleDeg(pelvisSegment) - (neutral?.lumbarFlexionDeg ?? 0),
        thoracicFlexionDeg:
            sagittalAngleDeg(upperThoracicSegment) -
            sagittalAngleDeg(lowerThoracicSegment) -
            (neutral?.thoracicFlexionDeg ?? 0),
        kneeFlexionDeg: kneeFlexionDeg - (neutral?.kneeFlexionDeg ?? 0),
        twistDeg: signedAngleDeg(hipLine, shoulderLine, trunkAxis) - (neutral?.twistDeg ?? 0),
        lateralBendDeg:
            Math.asin(Math.max(-1, Math.min(1, dot(trunkAxis, lateralAxis)))) * RAD_TO_DEG -
            (neutral?.lateralBendDeg ?? 0),
        hipCenter,
        lateralAxis,
        trunkLength: length(trunk),
    };
}

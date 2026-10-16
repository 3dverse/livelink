//------------------------------------------------------------------------------
import { useMemo } from "react";
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import {
    NEUTRAL_POSTURE,
    computeBodyPose,
    useBodyRig,
    useSendBodyPose,
    type BodyLandmarks,
    type BodyPosture,
} from "./bodyRig";
import { measureTrunkPosture, type TrunkPosture } from "./trunkPosture";

//------------------------------------------------------------------------------
/**
 * Puts the robot in `posture`, and measures it the way a body capture would: from the landmarks of its joints,
 * relative to its upright standing posture, measured once as a calibration.
 */
export function useMeasuredBody(posture: BodyPosture): {
    isPending: boolean;
    isFound: boolean;
    landmarks: BodyLandmarks | null;
    measurement: TrunkPosture | null;
    /** Landmarks of the upright standing posture. */
    standingLandmarks: BodyLandmarks | null;
} {
    const { isPending, rig } = useBodyRig();

    const bodyPose = useMemo(() => (rig ? computeBodyPose(rig, posture) : null), [rig, posture]);
    useSendBodyPose(rig, bodyPose?.partialPose ?? null);

    const calibration = useMemo(() => {
        if (!rig) {
            return null;
        }
        const { landmarks } = computeBodyPose(rig, NEUTRAL_POSTURE);
        return { landmarks, neutral: measureTrunkPosture(landmarks) };
    }, [rig]);

    const measurement = useMemo(
        () => (bodyPose && calibration ? measureTrunkPosture(bodyPose.landmarks, calibration.neutral) : null),
        [bodyPose, calibration],
    );

    return {
        isPending,
        isFound: rig !== null,
        landmarks: bodyPose?.landmarks ?? null,
        measurement,
        standingLandmarks: calibration?.landmarks ?? null,
    };
}

/** Point `height` above `position`. */
export function above(position: Vec3, height: number): Vec3 {
    return [position[0], position[1] + height, position[2]];
}

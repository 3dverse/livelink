//------------------------------------------------------------------------------
import { useContext, useEffect, useMemo } from "react";
import type { Commands, Entity, Quat, Vec3 } from "@3dverse/livelink";
import { LivelinkContext, useEntities, useEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { axisAngleToQuat, conjugateQuat, multiplyQuat, rotateVec3 } from "../../components/RotationGizmo/math";
import { add, midpoint, subtract } from "../../components/DOM3DAngleAlert/vector";
import { CONTROLLER_EUID } from "../PromptSkeletonPosition/rig";

//------------------------------------------------------------------------------
/**
 * Posture of the robot, as the angles a clinician would describe a forward bend with. All in degrees.
 */
export type BodyPosture = {
    /** Forward tilt of the pelvis around the hip joints: bending at the hips, the trunk following it. */
    pelvisTiltDeg: number;
    /**
     * Forward bend of the lower back, between the pelvis and the waist, shared between the pivots of the spine at
     * the hips and at the waist: rounding the lower back.
     */
    lumbarFlexionDeg: number;
    /** Forward bend of the upper back, at the pivot of the spine at the chest: hunching. */
    thoracicFlexionDeg: number;
    /** Bend of both knees, 0 for straight legs. The feet stay flat on the ground. */
    kneeFlexionDeg: number;
    /** Turn of the shoulders relative to the pelvis, around the spine, + to the left. */
    twistDeg: number;
};

export const NEUTRAL_POSTURE: BodyPosture = {
    pelvisTiltDeg: 0,
    lumbarFlexionDeg: 0,
    thoracicFlexionDeg: 0,
    kneeFlexionDeg: 0,
    twistDeg: 0,
};

/**
 * Bones of the robot whose joints are the landmarks a body capture would track, by landmark: e.g. the joint of
 * the thigh bone is the hip joint.
 */
const LANDMARK_BONE_NAMES = {
    leftHip: "Droid_SK_LeftUpLeg",
    rightHip: "Droid_SK_RightUpLeg",
    /** Pivots of the spine: at the hips, the base of the lumbar spine. */
    spineBase: "Droid_SK_Spine",
    /** At the waist, between the lumbar and the thoracic spine. */
    waist: "Droid_SK_Spine1",
    /** At the chest, in the thoracic spine. */
    chest: "Droid_SK_Spine2",
    /** Base of the neck, C7. */
    neckBase: "Droid_SK_Neck",
    head: "Droid_SK_Head",
    leftShoulder: "Droid_SK_LeftArm",
    rightShoulder: "Droid_SK_RightArm",
    leftKnee: "Droid_SK_LeftLeg",
    rightKnee: "Droid_SK_RightLeg",
    leftAnkle: "Droid_SK_LeftFoot",
    rightAnkle: "Droid_SK_RightFoot",
} as const;

export type BodyLandmarks = Record<keyof typeof LANDMARK_BONE_NAMES, Vec3>;

const PELVIS_BONE_NAME = "Droid_SK_Hips";

/** The arms hang from the shoulders whatever the trunk does, slightly away from the body. */
const ARM_DROP_DEG = 84;
/** Share of the knee bend taken by the thighs swinging forward, the rest by the shins leaning forward. */
const THIGH_SHARE_OF_KNEE_FLEXION = 0.55;
/** Share of the lumbar flexion taken by the pivot at the hips, the rest by the pivot at the waist. */
const LUMBAR_SHARE_AT_HIPS = 0.45;
/**
 * Share of the twist reached at the waist, the rest coming from the chest: the lumbar spine barely rotates, the
 * thoracic spine does most of it.
 */
const TWIST_SHARE_AT_WAIST = 0.25;

const IDENTITY: Quat = [0, 0, 0, 1];
const BONE_ENTITIES_QUERY = { mandatory_components: ["bone" as const] };

//------------------------------------------------------------------------------
export type BodyRig = {
    controller: Entity;
    pelvis: Entity;
    landmarkBones: Record<keyof typeof LANDMARK_BONE_NAMES, Entity>;
    /** Every bone of the skeleton, parents before children. */
    hierarchy: Array<Entity>;
    /** World transform of every bone in the rest pose, which is what the scene holds. */
    rest: Map<Entity, { position: Vec3; orientation: Quat }>;
    /** Local orientation of every bone in the rest pose. */
    restLocalOrientations: Map<Entity, Quat>;
    /** Root bone of the skeleton, moved to keep the feet where they are. Its parent isn't a bone. */
    root: Entity;
    rootRestLocalPosition: Vec3;
    rootParentOrientation: Quat;
};

/**
 * Finds the bones and the animation controller of the robot, and puts it in its rest pose, a T-pose, which the
 * postures are applied to.
 */
export function useBodyRig(): { isPending: boolean; rig: BodyRig | null } {
    const { instance } = useContext(LivelinkContext);
    const { isPending: isControllerPending, entity: controller } = useEntity({ euid: CONTROLLER_EUID });
    const { isPending: areBonesPending, entities: boneEntities } = useEntities(BONE_ENTITIES_QUERY);

    const rig = useMemo(() => createBodyRig(controller, boneEntities), [controller, boneEntities]);

    useEffect(() => {
        if (!instance || !rig) {
            return;
        }
        const orientations = Array.from(rig.restLocalOrientations, ([entity, value]) => ({
            bone_index: entity.bone!.boneIndex,
            value,
        }));
        instance.sendSkeletonPose({ controller: rig.controller, partial_pose: { orientations } });
    }, [instance, rig]);

    return { isPending: isControllerPending || areBonesPending, rig };
}

export function useSendBodyPose(rig: BodyRig | null, partialPose: Commands.SkeletonPartialPose | null): void {
    const { instance } = useContext(LivelinkContext);

    useEffect(() => {
        if (!instance || !rig || !partialPose) {
            return;
        }
        instance.sendSkeletonPose({ controller: rig.controller, partial_pose: partialPose });
    }, [instance, rig, partialPose]);
}

//------------------------------------------------------------------------------
/**
 * Pose of the robot for a posture, and where its landmarks end up.
 *
 * Each moving segment is given a rotation in world space, around its joint, from its rest orientation: the
 * pelvis tilts forward around the lateral axis of the body; the spine above it bends further at its pivots, by the
 * lumbar flexion at the hips and the waist and by the thoracic flexion at the chest, and twists, mostly at the
 * chest; the thighs and shins lean to bend the knees, while the feet stay flat and the arms hang. The other bones
 * follow their parent. The whole body is then moved so that the feet stay where they are at rest.
 */
export function computeBodyPose(
    rig: BodyRig,
    posture: BodyPosture,
): { partialPose: Commands.SkeletonPartialPose; landmarks: BodyLandmarks } {
    const { landmarkBones: bones } = rig;
    const thighSwingDeg = posture.kneeFlexionDeg * THIGH_SHARE_OF_KNEE_FLEXION;
    const shinLeanDeg = posture.kneeFlexionDeg - thighSwingDeg;
    const waistTiltDeg = posture.pelvisTiltDeg + posture.lumbarFlexionDeg;

    // The robot faces +z, its left is +x: forward bends are rotations around +x, and twists around +y, applied
    // before the bend so that they turn each segment around its own length.
    const bendAndTwist = (bendDeg: number, twistDeg: number): Quat =>
        multiplyQuat(rotationAround([1, 0, 0], bendDeg), rotationAround([0, 1, 0], twistDeg));
    const rotations = new Map<Entity, Quat>([
        [rig.pelvis, rotationAround([1, 0, 0], posture.pelvisTiltDeg)],
        [
            bones.spineBase,
            rotationAround([1, 0, 0], posture.pelvisTiltDeg + posture.lumbarFlexionDeg * LUMBAR_SHARE_AT_HIPS),
        ],
        [bones.waist, bendAndTwist(waistTiltDeg, posture.twistDeg * TWIST_SHARE_AT_WAIST)],
        [bones.chest, bendAndTwist(waistTiltDeg + posture.thoracicFlexionDeg, posture.twistDeg)],
        [bones.leftShoulder, rotationAround([0, 0, 1], -ARM_DROP_DEG)],
        [bones.rightShoulder, rotationAround([0, 0, 1], ARM_DROP_DEG)],
        [bones.leftHip, rotationAround([1, 0, 0], -thighSwingDeg)],
        [bones.rightHip, rotationAround([1, 0, 0], -thighSwingDeg)],
        [bones.leftKnee, rotationAround([1, 0, 0], shinLeanDeg)],
        [bones.rightKnee, rotationAround([1, 0, 0], shinLeanDeg)],
        [bones.leftAnkle, IDENTITY],
        [bones.rightAnkle, IDENTITY],
    ]);

    // World rotation and position of every bone, from the root down, before moving the body.
    const rotationOf = new Map<Entity, Quat>();
    const positionOf = new Map<Entity, Vec3>();
    for (const bone of rig.hierarchy) {
        const parent = bone.parent && rig.rest.has(bone.parent) ? bone.parent : null;
        const parentRotation = parent ? rotationOf.get(parent)! : IDENTITY;
        rotationOf.set(bone, rotations.get(bone) ?? parentRotation);

        const restPosition = rig.rest.get(bone)!.position;
        positionOf.set(
            bone,
            parent
                ? add(
                      positionOf.get(parent)!,
                      rotateVec3(parentRotation, subtract(restPosition, rig.rest.get(parent)!.position)),
                  )
                : restPosition,
        );
    }

    const restFeet = midpoint(rig.rest.get(bones.leftAnkle)!.position, rig.rest.get(bones.rightAnkle)!.position);
    const posedFeet = midpoint(positionOf.get(bones.leftAnkle)!, positionOf.get(bones.rightAnkle)!);
    const offset = subtract(restFeet, posedFeet);

    const orientations = Array.from(rotations, ([bone, rotation]) => {
        const parent = bone.parent && rig.rest.has(bone.parent) ? bone.parent : null;
        const parentOrientation = parent
            ? multiplyQuat(rotationOf.get(parent)!, rig.rest.get(parent)!.orientation)
            : rig.rootParentOrientation;
        const orientation = multiplyQuat(rotation, rig.rest.get(bone)!.orientation);
        return { bone_index: bone.bone!.boneIndex, value: multiplyQuat(conjugateQuat(parentOrientation), orientation) };
    });
    const positions = [
        {
            bone_index: rig.root.bone!.boneIndex,
            value: add(rig.rootRestLocalPosition, rotateVec3(conjugateQuat(rig.rootParentOrientation), offset)),
        },
    ];

    const landmarks = Object.fromEntries(
        Object.entries(bones).map(([landmark, bone]) => [landmark, add(positionOf.get(bone)!, offset)]),
    ) as BodyLandmarks;

    return { partialPose: { orientations, positions }, landmarks };
}

//------------------------------------------------------------------------------
function createBodyRig(controller: Entity | null, boneEntities: Array<Entity>): BodyRig | null {
    const findBone = (entityName: string): Entity | undefined =>
        boneEntities.find(entity => entity.name === entityName);

    const pelvis = findBone(PELVIS_BONE_NAME);
    const landmarkBones = Object.fromEntries(
        Object.entries(LANDMARK_BONE_NAMES).map(([landmark, entityName]) => [landmark, findBone(entityName)]),
    ) as Partial<BodyRig["landmarkBones"]>;
    if (!controller || !pelvis || Object.values(landmarkBones).some(bone => !bone)) {
        return null;
    }

    const boneSet = new Set(boneEntities);
    const depthOf = (entity: Entity): number => {
        let depth = 0;
        for (let parent = entity.parent; parent && boneSet.has(parent); parent = parent.parent) {
            depth++;
        }
        return depth;
    };
    const hierarchy = [...boneEntities].sort((a, b) => depthOf(a) - depthOf(b));

    let root = pelvis;
    while (root.parent && boneSet.has(root.parent)) {
        root = root.parent;
    }

    return {
        controller,
        pelvis,
        landmarkBones: landmarkBones as BodyRig["landmarkBones"],
        hierarchy,
        rest: new Map(
            boneEntities.map(entity => [
                entity,
                {
                    position: [...entity.global_transform.position] as Vec3,
                    orientation: [...entity.global_transform.orientation] as Quat,
                },
            ]),
        ),
        restLocalOrientations: new Map(
            boneEntities.map(entity => [entity, [...entity.local_transform.orientation] as Quat]),
        ),
        root,
        rootRestLocalPosition: [...root.local_transform.position] as Vec3,
        rootParentOrientation: root.parent ? ([...root.parent.global_transform.orientation] as Quat) : IDENTITY,
    };
}

function rotationAround(axis: Vec3, angleDeg: number): Quat {
    return axisAngleToQuat(axis, angleDeg);
}

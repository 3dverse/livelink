//------------------------------------------------------------------------------
import { useContext, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Quat, Vec3 } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    DOM3DOverlay,
    LivelinkContext,
    useCameraEntity,
    useEntities,
    useEntity,
} from "@3dverse/livelink-react";
import {
    LoadingOverlay,
    RotationGizmo,
    type RotationGizmoProps,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "1c9d3c89-99b6-417e-bb4f-34916c470781";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

/** Entity holding the animation controller of the robot, to which poses are sent. */
const controller_euid = "4ad7952a-bcda-4f64-ae4b-9df208228256";

const camera_position: Vec3 = [0.67, 1.52, 1.34];
const camera_target: Vec3 = [0, 1.3, -0.1];

//------------------------------------------------------------------------------
type BoneName = "head" | "neck" | "waist";
type Pose = Record<BoneName, Vec3>;

/**
 * In this rig, the x axis of a bone runs along it: rotating around x twists
 * the bone, around z bends it forward or backward, around y leans it sideways.
 */
const bones: Record<
    BoneName,
    Pick<RotationGizmoProps, "label" | "axisLabels" | "limits"> & {
        entityName: string;
    }
> = {
    head: {
        entityName: "Droid_SK_Head",
        label: "Head",
        axisLabels: { x: "Turn", y: "Tilt", z: "Nod" },
        limits: { x: [-80, 80], y: [-35, 35], z: [-40, 45] },
    },
    neck: {
        entityName: "Droid_SK_Neck",
        label: "Neck",
        axisLabels: { x: "Turn", y: "Tilt", z: "Nod" },
        limits: { x: [-45, 45], y: [-30, 30], z: [-30, 40] },
    },
    waist: {
        entityName: "Droid_SK_Spine",
        label: "Waist",
        axisLabels: { x: "Twist", y: "Lean", z: "Bend" },
        limits: { x: [-60, 60], y: [-30, 30], z: [-25, 60] },
    },
};
const bone_names = Object.keys(bones) as Array<BoneName>;
const rest_pose: Pose = { head: [0, 0, 0], neck: [0, 0, 0], waist: [0, 0, 0] };

/** Looks around, as if idling, for a time in seconds. */
function idleAnimation(t: number): Pose {
    return {
        head: [
            45 * Math.sin(t * 0.7),
            8 * Math.sin(t * 1.3),
            12 * Math.sin(t * 1.1 + 1),
        ],
        neck: [10 * Math.sin(t * 0.7 - 0.4), 0, 8 * Math.sin(t * 0.9)],
        waist: [
            20 * Math.sin(t * 0.5),
            6 * Math.sin(t * 0.8 + 2),
            10 + 8 * Math.sin(t * 0.6),
        ],
    };
}

//------------------------------------------------------------------------------
export function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
            isTransient={true}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({ position: camera_position });
    const skeleton = useRobotSkeleton();
    const [pose, setPose] = useState<Pose>(rest_pose);
    const [isAnimating, setIsAnimating] = useState(false);

    useSendPose(skeleton, pose);

    // Drives every bone from the animation while it plays.
    useEffect(() => {
        if (!isAnimating) {
            return;
        }
        const start = performance.now();
        const intervalId = setInterval(
            () => setPose(idleAnimation((performance.now() - start) / 1000)),
            1000 / 30,
        );
        return () => clearInterval(intervalId);
    }, [isAnimating]);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController ref={lookAtRobot} />
                {skeleton && (
                    <DOM3DOverlay>
                        {bone_names.map(boneName => (
                            <BoneGizmo
                                key={boneName}
                                boneName={boneName}
                                skeleton={skeleton}
                                pose={pose}
                                readOnly={isAnimating}
                                onChange={value =>
                                    setPose(previous => ({
                                        ...previous,
                                        [boneName]: value,
                                    }))
                                }
                            />
                        ))}
                    </DOM3DOverlay>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                    <button
                        className="button button-overlay"
                        onClick={() => setPose(rest_pose)}
                    >
                        Reset pose
                    </button>
                    <button
                        className="button button-overlay"
                        aria-pressed={isAnimating}
                        onClick={() => setIsAnimating(previous => !previous)}
                    >
                        {isAnimating ? "Pause animation" : "Play animation"}
                    </button>
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
/**
 * The orbital camera controller orbits around the origin by default, so it is
 * aimed at the robot instead. Declared once so that the ref callback isn't
 * called again on every render.
 */
function lookAtRobot(controller: DefaultCameraController | undefined | null) {
    controller?.setLookAt(...camera_position, ...camera_target, false);
}

//------------------------------------------------------------------------------
/**
 * The gizmo of a bone, on its joint, its rings around the axes of the bone at
 * rest. The scene only knows the rest pose, so both are computed from the pose
 * sent, e.g. so that the head gizmo follows the head when bending the waist.
 */
function BoneGizmo({
    boneName,
    skeleton,
    pose,
    readOnly,
    onChange,
}: {
    boneName: BoneName;
    skeleton: RobotSkeleton;
    pose: Pose;
    readOnly: boolean;
    onChange: (value: Vec3) => void;
}) {
    const entity = skeleton.bones[boneName];
    const { worldPosition, restFrame } = useMemo(() => {
        const parent = computePosedTransform(entity.parent!, skeleton, pose);
        const offset = rotateVec3(
            parent.orientation,
            entity.local_transform.position,
        );
        return {
            worldPosition: parent.position.map((c, i) => c + offset[i]) as Vec3,
            restFrame: multiplyQuat(
                parent.orientation,
                restOrientation(entity, skeleton),
            ),
        };
    }, [entity, skeleton, pose]);

    const { entityName: _, ...props } = bones[boneName];
    return (
        <RotationGizmo
            {...props}
            size={100}
            worldPosition={worldPosition}
            orientation={restFrame}
            value={pose[boneName]}
            onChange={onChange}
            readOnly={readOnly}
        />
    );
}

//------------------------------------------------------------------------------
type RobotSkeleton = {
    controller: Entity;
    bones: Record<BoneName, Entity>;
    /** Local orientation of every bone in the rest pose, by bone index. */
    restOrientations: Map<number, Quat>;
};

/**
 * Finds the bones and the animation controller of the robot. Bone entities
 * have a `bone` component holding their index in the skeleton.
 */
function useRobotSkeleton(): RobotSkeleton | null {
    const { instance } = useContext(LivelinkContext);
    const { entity: controller } = useEntity({ euid: controller_euid });
    const { entities } = useEntities(bone_entities_query);

    const skeleton = useMemo(() => {
        const find = (name: BoneName) =>
            entities.find(entity => entity.name === bones[name].entityName);
        const [head, neck, waist] = [find("head"), find("neck"), find("waist")];
        if (!controller || !head || !neck || !waist) {
            return null;
        }
        // The scene holds the rest pose: the animation only plays when rendering.
        const restOrientations = new Map(
            entities.map(entity => [
                entity.bone!.boneIndex,
                [...entity.local_transform.orientation] as Quat,
            ]),
        );
        return { controller, bones: { head, neck, waist }, restOrientations };
    }, [controller, entities]);

    // Puts every bone in its rest pose, which the gizmos measure from.
    useEffect(() => {
        if (!instance || !skeleton) {
            return;
        }
        const orientations = Array.from(
            skeleton.restOrientations,
            ([bone_index, value]) => ({ bone_index, value }),
        );
        instance.sendSkeletonPose({
            controller: skeleton.controller,
            partial_pose: { orientations },
        });
    }, [instance, skeleton]);

    return skeleton;
}
const bone_entities_query = { mandatory_components: ["bone" as const] };

//------------------------------------------------------------------------------
/** Sends the orientation of the posed bones to the animation controller. */
function useSendPose(skeleton: RobotSkeleton | null, pose: Pose) {
    const { instance } = useContext(LivelinkContext);

    useEffect(() => {
        if (!instance || !skeleton) {
            return;
        }
        const orientations = bone_names.map(boneName => {
            const entity = skeleton.bones[boneName];
            return {
                bone_index: entity.bone!.boneIndex,
                value: posedOrientation(entity, skeleton, pose),
            };
        });
        instance.sendSkeletonPose({
            controller: skeleton.controller,
            partial_pose: { orientations },
        });
    }, [instance, skeleton, pose]);
}

//------------------------------------------------------------------------------
// Bone math. Quaternions are [x, y, z, w], as in Livelink.

function restOrientation(entity: Entity, skeleton: RobotSkeleton): Quat {
    return skeleton.restOrientations.get(entity.bone!.boneIndex)!;
}

/** Rest orientation of a bone, then the rotation of its gizmo, in bone space. */
function posedOrientation(
    entity: Entity,
    skeleton: RobotSkeleton,
    pose: Pose,
): Quat {
    const boneName = bone_names.find(name => skeleton.bones[name] === entity);
    const rest = restOrientation(entity, skeleton);
    return boneName ? multiplyQuat(rest, eulerToQuat(pose[boneName])) : rest;
}

/** World transform of an entity in the current pose. */
function computePosedTransform(
    entity: Entity,
    skeleton: RobotSkeleton,
    pose: Pose,
): { position: Vec3; orientation: Quat } {
    if (!entity.bone || !entity.parent) {
        return {
            position: [...entity.global_transform.position] as Vec3,
            orientation: [...entity.global_transform.orientation] as Quat,
        };
    }
    const parent = computePosedTransform(entity.parent, skeleton, pose);
    const offset = rotateVec3(
        parent.orientation,
        entity.local_transform.position,
    );
    return {
        position: parent.position.map((c, i) => c + offset[i]) as Vec3,
        orientation: multiplyQuat(
            parent.orientation,
            posedOrientation(entity, skeleton, pose),
        ),
    };
}

/** Rotations around x, then y, then z, each around the axes rotated before. */
function eulerToQuat([x, y, z]: Vec3): Quat {
    const axisAngle = (axis: 0 | 1 | 2, angleDeg: number): Quat => {
        const half = (angleDeg * Math.PI) / 360;
        const quat: Quat = [0, 0, 0, Math.cos(half)];
        quat[axis] = Math.sin(half);
        return quat;
    };
    return multiplyQuat(
        multiplyQuat(axisAngle(0, x), axisAngle(1, y)),
        axisAngle(2, z),
    );
}

function multiplyQuat([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat {
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ];
}

function rotateVec3([qx, qy, qz, qw]: Quat, [vx, vy, vz]: Vec3): Vec3 {
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return [
        vx + qw * tx + qy * tz - qz * ty,
        vy + qw * ty + qz * tx - qx * tz,
        vz + qw * tz + qx * ty - qy * tx,
    ];
}

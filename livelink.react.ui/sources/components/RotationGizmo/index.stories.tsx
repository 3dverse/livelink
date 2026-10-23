//------------------------------------------------------------------------------
import React, { useContext, useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Commands, Entity, Quat, Vec3 } from "@3dverse/livelink";
import {
    CameraController,
    Canvas,
    DefaultCameraController,
    DOM3DOverlay,
    LivelinkContext,
    useCameraEntity,
    useEntities,
    useEntity,
    Viewport,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { RotationGizmo, type RotationGizmoAxes, type RotationGizmoAxis, type RotationGizmoProps } from ".";
import { axisAngleToQuat, multiplyQuat, rotateVec3 } from "./math";
import { Button } from "../../components-common/Button";
import { SKELETON_SCENE_ID } from "../../../.storybook/sceneIds";

//------------------------------------------------------------------------------
/**
 * Entity holding the animation controller of the robot. Skeleton poses are sent to it, and they
 * override the pose computed by its animation graph.
 */
const CONTROLLER_EUID = "4ad7952a-bcda-4f64-ae4b-9df208228256";

/** Frames the upper body of the robot, slightly from its left, close enough for the gizmos of the head and
 * the neck, whose joints are 14 cm apart, to barely overlap. */
const CAMERA_POSITION: Vec3 = [0.67, 1.52, 1.34];
const CAMERA_TARGET: Vec3 = [0, 1.3, -0.1];

/** Every entity bound to a bone of a skeleton has a `bone` component holding the bone index. */
const BONE_ENTITIES_QUERY = { mandatory_components: ["bone" as const] };

//------------------------------------------------------------------------------
type BoneName = "head" | "neck" | "waist";
type Pose = Record<BoneName, Vec3>;

/**
 * Bone entities of the robot rig. In this rig, the x axis of a bone runs along it, up the spine, so
 * rotating around x twists the bone, around z bends it forward or backward, and around y leans it sideways.
 */
const BONES: Record<
    BoneName,
    {
        entityName: string;
        label: string;
        axisLabels: Record<RotationGizmoAxis, string>;
        limits: RotationGizmoProps["limits"];
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
const BONE_NAMES = Object.keys(BONES) as Array<BoneName>;

const REST_POSE: Pose = { head: [0, 0, 0], neck: [0, 0, 0], waist: [0, 0, 0] };

//------------------------------------------------------------------------------
type StoryArgs = Pick<
    RotationGizmoProps,
    | "variant"
    | "readOnly"
    | "size"
    | "showValues"
    | "showAxisLabels"
    | "showSphere"
    | "showPoleLabels"
    | "showReferenceMarks"
    | "showOutOfRange"
    | "showContextMenu"
    | "decimals"
    | "snap"
    | "step"
>;

const meta = {
    title: "Components/Rotation Gizmo",
    id: "components-rotation-gizmo",
    component: RotationGizmo,
    parameters: {
        layout: "fullscreen",
        livelinkSceneId: SKELETON_SCENE_ID,
    },
    args: {
        value: [0, 0, 0],
        variant: "default",
        size: 100,
        showValues: "always",
        showAxisLabels: "hover",
        showSphere: true,
        showPoleLabels: true,
        showReferenceMarks: true,
        showOutOfRange: true,
        showContextMenu: true,
        decimals: 0,
        snap: 0,
        step: 1,
        readOnly: false,
    },
    argTypes: {
        value: { control: false },
        variant: { control: "radio", options: ["default", "flat"] },
        showValues: { control: "radio", options: ["always", "hover", "never"] },
        showAxisLabels: { control: "radio", options: ["always", "hover", "never"] },
        orientation: { control: false },
        viewOrientation: { control: false },
        axes: { control: false },
        limits: { control: false },
        colors: { control: false },
        axisLabels: { control: false },
        label: { control: false },
        worldPosition: { control: false },
        size: { control: { type: "range", min: 80, max: 200, step: 4 } },
        decimals: { control: { type: "range", min: 0, max: 2, step: 1 } },
        snap: { control: { type: "range", min: 0, max: 45, step: 5 } },
    },
} satisfies Meta<typeof RotationGizmo>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
/**
 * Drag a handle along its ring to rotate the bone, or focus it and use the arrow keys (Shift for steps of
 * 10°). Hold Shift while dragging to snap to 15°, double-click a ring to reset it. Each ring is clamped to
 * the range of motion of the joint, the dotted part of the ring being out of reach.
 *
 * The sphere of each gizmo is oriented like the bone at rest, as seen from the camera: each ring lies in the
 * plane the bone turns in around that axis. Orbit the camera to see them follow.
 */
export const _Component: Story = {
    render: args => <RobotDemo gizmoProps={args} />,
};

//------------------------------------------------------------------------------
/**
 * The robot is animated by the story, and the gizmos only display the rotation of each bone. Pause the
 * animation to freeze them.
 */
export const ReadOnly: Story = {
    args: { readOnly: true },
    render: args => <RobotDemo gizmoProps={args} autoPlay />,
};

//------------------------------------------------------------------------------
/**
 * Each gizmo picks the rotations it edits, the ones it only displays, and hides the others: the waist
 * sways on its own and is only displayed, the neck only nods, and the head can turn and nod while its tilt,
 * driven by the animation, is only displayed.
 */
export const PerAxisModes: Story = {
    render: args => (
        <RobotDemo
            gizmoProps={args}
            animation={animateSway}
            autoPlay
            axes={{
                head: { x: "edit", y: "read", z: "edit" },
                neck: { z: "edit" },
                waist: { x: "read", y: "read", z: "read" },
            }}
        />
    ),
};

//------------------------------------------------------------------------------
/**
 * The gizmo on its own, with the default colors and range. Without a `worldPosition`, it is rendered where it
 * is placed in the page, and outside of a viewport, the sphere is seen from a three-quarter view.
 */
export const Standalone: Story = {
    parameters: {
        livelink: false,
    },
    args: { label: "Rotation" },
    render: args => <StandaloneDemo {...args} />,
};

//------------------------------------------------------------------------------
function StandaloneDemo(props: RotationGizmoProps): React.JSX.Element {
    const [value, setValue] = useState<Vec3>([30, -45, 90]);
    return (
        <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
            <RotationGizmo {...props} value={value} onChange={setValue} />
        </div>
    );
}

//------------------------------------------------------------------------------
/** Rotations of the bones driven by the story rather than by the gizmos, for a time in seconds. */
type Animation = (timeSec: number) => Partial<Record<BoneName, Partial<Record<RotationGizmoAxis, number>>>>;

const ANIMATION_FPS = 30;

/** Looks around, as if idling. */
const animateIdle: Animation = t => ({
    head: { x: 45 * Math.sin(t * 0.7), y: 8 * Math.sin(t * 1.3), z: 12 * Math.sin(t * 1.1 + 1) },
    neck: { x: 10 * Math.sin(t * 0.7 - 0.4), z: 8 * Math.sin(t * 0.9) },
    waist: { x: 20 * Math.sin(t * 0.5), y: 6 * Math.sin(t * 0.8 + 2), z: 10 + 8 * Math.sin(t * 0.6) },
});

/** Sways the waist and slightly tilts the head, leaving the other axes to the gizmos. */
const animateSway: Animation = t => ({
    head: { y: 10 * Math.sin(t * 1.2) },
    waist: { x: 15 * Math.sin(t * 0.5), y: 8 * Math.sin(t * 0.8 + 2), z: 6 * Math.sin(t * 0.6) },
});

//------------------------------------------------------------------------------
const TOOLBAR_BUTTON_STYLE: React.CSSProperties = { backgroundColor: "var(--3dverse-color-bg-overground)" };

function RobotDemo({
    gizmoProps,
    animation = animateIdle,
    autoPlay = false,
    axes,
}: {
    gizmoProps: StoryArgs;
    /** Played while the animate toggle is on. */
    animation?: Animation;
    autoPlay?: boolean;
    axes?: Partial<Record<BoneName, RotationGizmoAxes>>;
}): React.JSX.Element {
    const { cameraEntity } = useCameraEntity({ position: CAMERA_POSITION });

    const { isPending, bones } = useRobotSkeleton();
    const [pose, setPose] = useState<Pose>(REST_POSE);
    const [isAnimating, setIsAnimating] = useState(autoPlay);
    usePlayAnimation(isAnimating ? animation : undefined, setPose);
    useSendPose(bones, pose);

    if (!isPending && !bones) {
        console.error("The robot bones or its animation controller couldn't be found in the scene");
        return <div>Robot not found</div>;
    }

    return (
        <Canvas style={{ width: "100%", height: "100vh" }}>
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController ref={lookAtRobot} />
                {bones && (
                    <DOM3DOverlay>
                        {BONE_NAMES.map(boneName => (
                            <BoneGizmo
                                key={boneName}
                                boneName={boneName}
                                pose={pose}
                                bones={bones}
                                gizmoProps={{
                                    ...gizmoProps,
                                    label: BONES[boneName].label,
                                    axisLabels: BONES[boneName].axisLabels,
                                    limits: BONES[boneName].limits,
                                    axes: axes?.[boneName],
                                    value: pose[boneName],
                                    onChange: value =>
                                        setPose(previousPose => ({ ...previousPose, [boneName]: value })),
                                }}
                            />
                        ))}
                    </DOM3DOverlay>
                )}
                <div style={{ position: "absolute", top: "1rem", left: "1rem", display: "flex", gap: "0.5rem" }}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPose(REST_POSE)}
                        style={TOOLBAR_BUTTON_STYLE}
                    >
                        Reset pose
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-pressed={isAnimating}
                        onClick={() => setIsAnimating(previous => !previous)}
                        style={TOOLBAR_BUTTON_STYLE}
                    >
                        {isAnimating ? "Pause animation" : "Play animation"}
                    </Button>
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
/**
 * The orbital camera controller orbits around a target, the origin by default, so it is aimed at the robot
 * instead. Declared once so that the ref callback isn't called again on every render.
 */
function lookAtRobot(cameraController: DefaultCameraController | undefined | null): void {
    cameraController?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false);
}

//------------------------------------------------------------------------------
/**
 * The gizmo of a bone, on its joint.
 */
function BoneGizmo({
    boneName,
    pose,
    bones,
    gizmoProps,
}: {
    boneName: BoneName;
    pose: Pose;
    bones: RobotBones;
    gizmoProps: RotationGizmoProps;
}): React.JSX.Element {
    // The joints move with the bones above them in the hierarchy, e.g. the head when bending the waist,
    // but the scene only knows the rest pose, so they are computed from the pose sent.
    const entity = bones.entities[boneName];
    const { jointPosition, restFrame } = useMemo(
        () => ({
            jointPosition: computePosedGlobalTransform(entity, bones, pose).position,
            restFrame: computePosedRestFrame(entity, bones, pose),
        }),
        [entity, bones, pose],
    );

    return <RotationGizmo {...gizmoProps} worldPosition={jointPosition} orientation={restFrame} />;
}

//------------------------------------------------------------------------------
type RobotBones = {
    controller: Entity;
    entities: Record<BoneName, Entity>;
    /** Local orientation of every bone in the rest pose, by bone index. */
    restOrientations: Map<number, Quat>;
};

/**
 * Finds the bone entities and the animation controller of the robot, and puts the robot in its rest pose
 * so that the bones start from the orientation the gizmos measure their rotation from.
 */
function useRobotSkeleton(): { isPending: boolean; bones: RobotBones | null } {
    const { instance } = useContext(LivelinkContext);
    const { isPending: isControllerPending, entity: controller } = useEntity({ euid: CONTROLLER_EUID });
    const { isPending: areBonesPending, entities: boneEntities } = useEntities(BONE_ENTITIES_QUERY);

    const bones = useMemo((): RobotBones | null => {
        const findBone = (boneName: BoneName): Entity | undefined =>
            boneEntities.find(entity => entity.name === BONES[boneName].entityName);
        const head = findBone("head");
        const neck = findBone("neck");
        const waist = findBone("waist");
        if (!controller || !head || !neck || !waist) {
            return null;
        }

        // The scene holds the rest pose: the animation only plays on the rendering side.
        const restOrientations = new Map(
            boneEntities.map(entity => [entity.bone!.boneIndex, [...entity.local_transform.orientation] as Quat]),
        );
        return { controller, entities: { head, neck, waist }, restOrientations };
    }, [controller, boneEntities]);

    useEffect(() => {
        if (!instance || !bones) {
            return;
        }

        const orientations = Array.from(bones.restOrientations, ([bone_index, value]) => ({ bone_index, value }));
        instance.sendSkeletonPose({ controller: bones.controller, partial_pose: { orientations } });
    }, [instance, bones]);

    return { isPending: isControllerPending || areBonesPending, bones };
}

//------------------------------------------------------------------------------
/**
 * Sends the orientation of the posed bones: their rest orientation, rotated by the delta of the gizmo.
 */
function useSendPose(bones: RobotBones | null, pose: Pose): void {
    const { instance } = useContext(LivelinkContext);

    useEffect(() => {
        if (!instance || !bones) {
            return;
        }

        const partial_pose: Commands.SkeletonPartialPose = {
            orientations: BONE_NAMES.map(boneName => {
                const bone_index = bones.entities[boneName].bone!.boneIndex;
                return { bone_index, value: computePosedOrientation(bones, bone_index, pose[boneName]) };
            }),
        };
        instance.sendSkeletonPose({ controller: bones.controller, partial_pose });
    }, [instance, bones, pose]);
}

//------------------------------------------------------------------------------
/**
 * Writes the rotations driven by `animate` into the pose, leaving the others to the gizmos.
 */
function usePlayAnimation(animate: Animation | undefined, setPose: React.Dispatch<React.SetStateAction<Pose>>): void {
    useEffect(() => {
        if (!animate) {
            return;
        }

        const startTime = performance.now();
        const intervalId = window.setInterval(() => {
            const animatedPose = animate((performance.now() - startTime) / 1000);
            setPose(pose => {
                const nextPose = { ...pose };
                for (const boneName of BONE_NAMES) {
                    const rotation = animatedPose[boneName];
                    if (rotation) {
                        nextPose[boneName] = [
                            rotation.x ?? pose[boneName][0],
                            rotation.y ?? pose[boneName][1],
                            rotation.z ?? pose[boneName][2],
                        ];
                    }
                }
                return nextPose;
            });
        }, 1000 / ANIMATION_FPS);

        return (): void => window.clearInterval(intervalId);
    }, [animate, setPose]);
}

//------------------------------------------------------------------------------
// Bone math. Quaternions are [x, y, z, w], as in Livelink.

/** Local orientation of a bone: its rest orientation, then the rotation of the gizmo, in the bone space. */
function computePosedOrientation(bones: RobotBones, boneIndex: number, rotation: Vec3): Quat {
    return multiplyQuat(bones.restOrientations.get(boneIndex)!, eulerToQuat(rotation));
}

/**
 * Rotation of the gizmo as a quaternion, applying x, then y, then z, each around the axis rotated by the
 * previous ones. Turning the head then nodding nods in the direction the head turned to.
 */
function eulerToQuat([x, y, z]: Vec3): Quat {
    return multiplyQuat(
        multiplyQuat(axisAngleToQuat([1, 0, 0], x), axisAngleToQuat([0, 1, 0], y)),
        axisAngleToQuat([0, 0, 1], z),
    );
}

/**
 * World orientation of the axes the gizmo of a bone rotates it around: the bone at rest, under its parent in
 * the current pose.
 */
function computePosedRestFrame(entity: Entity, bones: RobotBones, pose: Pose): Quat {
    const parentOrientation = entity.parent
        ? computePosedGlobalTransform(entity.parent, bones, pose).orientation
        : ([0, 0, 0, 1] as Quat);
    return multiplyQuat(parentOrientation, bones.restOrientations.get(entity.bone!.boneIndex)!);
}

/**
 * World transform of an entity in the current pose, composing the local transforms of the bones from the
 * first entity above the skeleton, which the pose doesn't move.
 */
function computePosedGlobalTransform(
    entity: Entity,
    bones: RobotBones,
    pose: Pose,
): { position: Vec3; orientation: Quat } {
    const boneIndex = entity.bone?.boneIndex;
    if (boneIndex === undefined || !entity.parent) {
        return {
            position: [...entity.global_transform.position] as Vec3,
            orientation: [...entity.global_transform.orientation] as Quat,
        };
    }

    const parent = computePosedGlobalTransform(entity.parent, bones, pose);
    const posedBoneName = BONE_NAMES.find(boneName => bones.entities[boneName] === entity);
    const localOrientation = posedBoneName
        ? computePosedOrientation(bones, boneIndex, pose[posedBoneName])
        : bones.restOrientations.get(boneIndex)!;

    // Bone scales are all 1 in this rig, so they are left out.
    const offset = rotateVec3(parent.orientation, entity.local_transform.position);
    return {
        position: [parent.position[0] + offset[0], parent.position[1] + offset[1], parent.position[2] + offset[2]],
        orientation: multiplyQuat(parent.orientation, localOrientation),
    };
}

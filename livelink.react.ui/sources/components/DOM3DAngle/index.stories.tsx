//------------------------------------------------------------------------------
import React, { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Vec3 } from "@3dverse/livelink";
import {
    CameraController,
    Canvas,
    DefaultCameraController,
    DOM3DOverlay,
    useCameraEntity,
    useEntity,
    Viewport,
} from "@3dverse/livelink-react";
import { ViewerPanel } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DOM3DAngle, type AngleHoldLimits, type AngleZone, type DOM3DAngleProps } from ".";
import { DOM3D_ANGLE_DEFAULTS } from "./defaults";
import { DOM3D_ANGLE_SCENE_ID } from "../../../.storybook/sceneIds";

//------------------------------------------------------------------------------
/** Entity of the scene turned around the vertical by `angleDeg`, as the link of a joint would be. */
const ENTITY_EUID = "c1c2ecff-247e-4066-86f0-e4fd3471c385";

/** Sees the gauge, lying flat around the entity, from high enough for it not to fade out edge-on. */
const CAMERA_POSITION: Vec3 = [2.4, 2.8, 2.4];
const CAMERA_TARGET: Vec3 = [0, 0, 0];

const UP: Vec3 = [0, 1, 0];
const FORWARD: Vec3 = [0, 0, 1];

/** Working range of a joint: free within ±60°, for a limited time up to ±90°, never beyond. */
const JOINT_ZONES: ReadonlyArray<AngleZone> = [
    { min: Number.NEGATIVE_INFINITY, max: -90, level: "notAcceptable" },
    { min: -90, max: -60, level: "conditional" },
    { min: -60, max: 60, level: "acceptable" },
    { min: 60, max: 90, level: "conditional" },
    { min: 90, max: Number.POSITIVE_INFINITY, level: "notAcceptable" },
];

/** Seconds the joint can stay in each zone: short enough to see the needle fill, then pulse. */
const JOINT_HOLD_LIMITS: AngleHoldLimits = { conditional: 5, notAcceptable: 2 };

//------------------------------------------------------------------------------
const meta = {
    title: "Components/DOM 3D Angle",
    id: "components-dom3d-angle",
    component: DOM3DAngle,
    parameters: {
        layout: "fullscreen",
        livelinkSceneId: DOM3D_ANGLE_SCENE_ID,
    },
    args: {
        // The defaults of the component, for the controls to start from them.
        ...DOM3D_ANGLE_DEFAULTS,
        worldPosition: [0, 0, 0],
        planeNormal: UP,
        referenceDirection: FORWARD,
        angleDeg: 40,

        size: 0.6,
        scaleRange: [-120, 120],
    },
    argTypes: {
        worldPosition: { control: false },
        planeNormal: { control: false },
        referenceDirection: { control: false },
        zones: { control: false },
        holdLimits: { control: "object" },
        exposure: { control: false },
        needleLength: { control: false },
        scaleRange: { control: false },
        children: { control: false },
        style: { control: false },
        angleDeg: { control: { type: "range", min: -150, max: 150, step: 1 } },
        size: { control: { type: "range", min: 0.2, max: 1, step: 0.05 } },
        scaleFadeDeg: { control: { type: "range", min: 0, max: 90, step: 5 } },
        uncertaintyDeg: { control: { type: "range", min: 0, max: 10, step: 1 } },
    },
} satisfies Meta<typeof DOM3DAngle>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
/**
 * The entity turns around the vertical by `angleDeg`, and the gauge, lying flat around it, measures the turn
 * against the working range of a joint: free within ±60°, for 5 s up to ±90°, for 2 s beyond. The needle fills with
 * the time held, then pulses once the limit is reached.
 *
 * Orbit until the gauge is seen edge-on: it fades out, while the needle, drawn facing the camera, keeps reading.
 */
export const _Component: Story = {
    render: args => <JointDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * With zones, the gauge measures the angle: the scale, its ticks, the angle and the needle are colored, and
 * nothing is timed.
 */
export const WithZones: Story = {
    render: args => <JointDemo {...args} zones={JOINT_ZONES} />,
};

//------------------------------------------------------------------------------
/**
 * With a hold limit only for the zones that aren't acceptable, the needle is a progress bar only there: it fills
 * over 3 s, then pulses. In the conditionally acceptable zones, it isn't timed.
 */
export const AlertWhenNotAcceptable: Story = {
    args: { angleDeg: 100, holdLimits: { notAcceptable: 3 } },
    render: args => <JointDemo {...args} zones={JOINT_ZONES} holdLimits={JOINT_HOLD_LIMITS} />,
};

//------------------------------------------------------------------------------
/**
 * With `uncertaintyDeg`, the accuracy of the measurement is shown around the needle, in the plane of the gauge.
 */
export const Uncertainty: Story = {
    args: { uncertaintyDeg: 5 },
    render: args => <JointDemo {...args} zones={JOINT_ZONES} />,
};

//------------------------------------------------------------------------------
/**
 * Without the needle, only the vertex is marked: to draw a shape of your own instead, e.g. the spine in the Back
 * Bending Monitor example.
 */
export const WithoutNeedle: Story = {
    args: { showNeedle: false },
    render: args => <JointDemo {...args} zones={JOINT_ZONES} />,
};

//------------------------------------------------------------------------------
/**
 * With `scaleFadeDeg`, both ends of the scale fade out over that angle, with their labels, rather than stopping.
 */
export const NoFadedScaleEnds: Story = {
    args: { scaleRange: [-150, 150], scaleFadeDeg: 0 },
    render: args => <JointDemo {...args} zones={JOINT_ZONES} />,
};

//------------------------------------------------------------------------------
/**
 * The `--dom3d-angle-*` variables, set here through `style`: thinner and longer ticks on a thinner scale,
 * and other colors for the zones.
 */
export const CustomTheme: Story = {
    args: {
        style: {
            "--dom3d-angle-tick-width": "0.2px",
            "--dom3d-angle-tick-length": "5px",
            "--dom3d-angle-zone-width": "0.6px",
            "--dom3d-angle-color-acceptable": "#38bdf8",
            "--dom3d-angle-color-conditional": "#a78bfa",
            "--dom3d-angle-color-not-acceptable": "#f472b6",
        } as React.CSSProperties,
    },
    render: args => <JointDemo {...args} zones={JOINT_ZONES} />,
};

//------------------------------------------------------------------------------
/**
 * Content given as `children`, here a plain label, is shown beside the vertex, on the side of the screen the scale
 * doesn't extend to.
 */
export const WithChildren: Story = {
    render: args => (
        <JointDemo {...args} zones={JOINT_ZONES} className="pointer-events-auto">
            <ViewerPanel
                style={{
                    padding: "2px 8px",
                    fontSize: "var(--3dverse-font-size-xs)",
                    backgroundColor: "var(--3dverse-color-bg-ground)",
                }}
            >
                Joint
                <span
                    style={{
                        display: "inline-block",
                        minWidth: "5ch",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {Math.round(args.angleDeg)}°
                </span>
            </ViewerPanel>
        </JointDemo>
    ),
};

//------------------------------------------------------------------------------
/**
 * Turns the entity of the scene by `angleDeg`, and shows the gauge around it.
 */
function JointDemo({
    worldPosition: _worldPosition,
    exposure: _exposure,
    ...gaugeProps
}: DOM3DAngleProps): React.JSX.Element {
    const { angleDeg } = gaugeProps;
    const { cameraEntity } = useCameraEntity({ position: CAMERA_POSITION });
    const { isPending, entity } = useEntity({ euid: ENTITY_EUID });

    useEffect(() => {
        if (entity) {
            entity.local_transform.eulerOrientation[1] = angleDeg;
        }
    }, [entity, angleDeg]);

    if (!isPending && !entity) {
        console.error("There's no entity with the configured euid in the scene");
    }

    const vertex = entity ? ([...entity.global_transform.position] as Vec3) : null;

    return (
        <Canvas style={{ width: "100%", height: "100vh" }}>
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController ref={lookAtTarget} />
                {vertex && (
                    <DOM3DOverlay>
                        <DOM3DAngle {...gaugeProps} worldPosition={vertex} />
                    </DOM3DOverlay>
                )}
            </Viewport>
        </Canvas>
    );
}

/**
 * Aims the orbital camera controller at the entity, from `CAMERA_POSITION`. Declared once so that the ref callback
 * isn't called again on every render.
 */
function lookAtTarget(cameraController: DefaultCameraController | undefined | null): void {
    cameraController?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false);
}

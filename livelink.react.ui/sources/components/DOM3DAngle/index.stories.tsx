//------------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Quat, Vec3 } from "@3dverse/livelink";
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
import {
    DOM3DAngle,
    type AngleExposureAlert,
    type AngleHoldLimits,
    type AngleZone,
    type AngleZoneLevel,
    type DOM3DAngleProps,
} from ".";
import { DOM3D_ANGLE_DEFAULTS } from "./defaults";
import { formatSeconds } from "./format";
import { useAngleExposure } from "./useAngleExposure";
import { ANGLE_ZONE_LEVEL_LABELS } from "./zones";
import { angleBetweenDeg, cross, length, normalize, reject, signedAngleDeg } from "./vector";
import { axisAngleToQuat, multiplyQuat, rotateVec3 } from "../RotationGizmo/math";
import { Button } from "../../components-common/Button";
import { DOM3D_ANGLE_SCENE_ID } from "../../../.storybook/sceneIds";

//------------------------------------------------------------------------------
/** Entity of the scene turned by `angleDeg` around `planeNormal`, from `referenceDirection`, as the link of a joint would be. */
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

/** The played rotation swings the joint across all its zones, slowly enough at the ends to stay beyond ±90° for 2 s. */
const ROTATION_AMPLITUDE_DEG = 110;
const ROTATION_PERIOD_SEC = 12;

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
        worldPosition: { control: "object" },
        planeNormal: { control: "object" },
        referenceDirection: { control: "object" },
        zones: { control: "object" },
        holdLimits: { control: "object" },
        exposure: { control: "object" },
        needleLength: { control: { type: "range", min: 0.2, max: 1, step: 0.05 } },
        scaleRange: { control: "object" },
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
 * Edit `planeNormal` and `referenceDirection` to measure in another plane: the entity turns in it.
 */
export const _Component: Story = {
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * With zones, the gauge measures the angle: the scale, its ticks, the angle and the needle are colored, and
 * nothing is timed.
 */
export const WithZones: Story = {
    args: { zones: JOINT_ZONES },
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * With a hold limit only for the zones that aren't acceptable, the needle is a progress bar only there: it fills
 * over 3 s, then pulses. In the conditionally acceptable zones, it isn't timed.
 *
 * Each alert is listed in a panel: the gauge is timed by `useAngleExposure`, whose result it is given as `exposure`,
 * and whose `onAlert` fills the list.
 */
export const AlertWhenOnNotAcceptableZone: Story = {
    args: { angleDeg: 100, zones: JOINT_ZONES, holdLimits: JOINT_HOLD_LIMITS },
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * With `uncertaintyDeg`, the accuracy of the measurement is shown around the needle, in the plane of the gauge.
 */
export const Uncertainty: Story = {
    args: { uncertaintyDeg: 5, zones: JOINT_ZONES },
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * Without the needle, only the vertex is marked: to draw a shape of your own instead, e.g. the spine in the Back
 * Bending Monitor example.
 */
export const WithoutNeedle: Story = {
    args: { showNeedle: false, zones: JOINT_ZONES },
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * With `scaleFadeDeg`, both ends of the scale fade out over that angle, with their labels, rather than stopping.
 */
export const NoFadedScaleEnds: Story = {
    args: { scaleRange: [-150, 150], scaleFadeDeg: 0, zones: JOINT_ZONES },
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * The `--dom3d-angle-*` variables, set here through `style`: thinner and longer ticks on a thinner scale,
 * and other colors for the zones.
 */
export const CustomTheme: Story = {
    args: {
        zones: JOINT_ZONES,
        style: {
            "--dom3d-angle-tick-width": "0.2px",
            "--dom3d-angle-tick-length": "5px",
            "--dom3d-angle-zone-width": "0.6px",
            "--dom3d-angle-color-acceptable": "#38bdf8",
            "--dom3d-angle-color-conditional": "#a78bfa",
            "--dom3d-angle-color-not-acceptable": "#f472b6",
        } as React.CSSProperties,
    },
    render: args => <DOM3DAngleDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * Content given as `children`, here a plain label, is shown beside the vertex, on the side of the screen the scale
 * doesn't extend to.
 */
export const WithChildren: Story = {
    render: args => (
        <DOM3DAngleDemo {...args} zones={JOINT_ZONES} className="pointer-events-auto">
            {angleDeg => (
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
                        {Math.round(angleDeg)}°
                    </span>
                </ViewerPanel>
            )}
        </DOM3DAngleDemo>
    ),
};

//------------------------------------------------------------------------------
/**
 * Turns the entity of the scene by `angleDeg` around `planeNormal`, from `referenceDirection`, or swings it back and
 * forth while the rotation plays, and shows the gauge around it. With zones and hold limits, it lists the alerts.
 * `children` can be a function of the angle shown, to follow the played rotation.
 */
function DOM3DAngleDemo({
    worldPosition: _worldPosition,
    exposure: _exposure,
    children,
    ...gaugeProps
}: Omit<DOM3DAngleProps, "children"> & {
    children?: React.ReactNode | ((angleDeg: number) => React.ReactNode);
}): React.JSX.Element {
    const { planeNormal, referenceDirection = DOM3D_ANGLE_DEFAULTS.referenceDirection, zones, holdLimits } = gaugeProps;
    const { angleDeg, isRotating, toggleRotation } = useRotation(gaugeProps.angleDeg);
    const { cameraEntity } = useCameraEntity({ position: CAMERA_POSITION });
    const { isPending, entity } = useEntity({ euid: ENTITY_EUID });

    useEffect(() => {
        if (entity) {
            entity.local_transform = { orientation: jointOrientation(planeNormal, referenceDirection, angleDeg) };
        }
    }, [entity, planeNormal, referenceDirection, angleDeg]);

    if (!isPending && !entity) {
        console.error("There's no entity with the configured euid in the scene");
    }

    const vertex = entity ? ([...entity.global_transform.position] as Vec3) : null;
    const content = typeof children === "function" ? children(angleDeg) : children;

    return (
        <Canvas style={{ width: "100%", height: "100vh" }}>
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController ref={lookAtTarget} />
                {vertex &&
                    (zones?.length && holdLimits ? (
                        <GaugeWithAlertList
                            {...gaugeProps}
                            zones={zones}
                            holdLimits={holdLimits}
                            angleDeg={angleDeg}
                            worldPosition={vertex}
                        >
                            {content}
                        </GaugeWithAlertList>
                    ) : (
                        <DOM3DOverlay>
                            <DOM3DAngle {...gaugeProps} angleDeg={angleDeg} worldPosition={vertex}>
                                {content}
                            </DOM3DAngle>
                        </DOM3DOverlay>
                    ))}
                <div style={{ position: "absolute", top: "1rem", left: "1rem" }}>
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-pressed={isRotating}
                        onClick={toggleRotation}
                        style={{ backgroundColor: "var(--3dverse-color-bg-overground)" }}
                    >
                        {isRotating ? "Pause rotation" : "Play rotation"}
                    </Button>
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
/** An alert raised by `useAngleExposure`, and when. */
type LoggedAlert = AngleExposureAlert & { id: number; time: Date };

const LEVEL_COLORS: Record<AngleZoneLevel, string> = {
    acceptable: "var(--3dverse-color-positive, #22c55e)",
    conditional: "var(--3dverse-color-warning, #f59e0b)",
    notAcceptable: "var(--3dverse-color-negative, #ef4444)",
};

/**
 * The gauge timed by `useAngleExposure` rather than by itself, for its exposure to be shared, here with the list of
 * the alerts raised, shown once there is one.
 */
function GaugeWithAlertList({
    zones,
    holdLimits,
    ...gaugeProps
}: DOM3DAngleProps & { zones: ReadonlyArray<AngleZone>; holdLimits: AngleHoldLimits }): React.JSX.Element {
    const [alerts, setAlerts] = useState<Array<LoggedAlert>>([]);
    const exposure = useAngleExposure({
        angleDeg: gaugeProps.angleDeg,
        zones,
        holdLimits,
        onAlert: alert =>
            setAlerts(previous => [{ ...alert, id: (previous[0]?.id ?? 0) + 1, time: new Date() }, ...previous]),
    });

    return (
        <>
            <DOM3DOverlay>
                <DOM3DAngle {...gaugeProps} zones={zones} exposure={exposure} />
            </DOM3DOverlay>
            {alerts.length > 0 && (
                <AlertList
                    alerts={alerts}
                    isLatestOngoing={exposure.status === "alert"}
                    onClear={() => setAlerts([])}
                />
            )}
        </>
    );
}

/**
 * The alerts, the latest first: the level the angle stayed at, when, the angle then, and the hold limit it exceeded.
 */
function AlertList({
    alerts,
    isLatestOngoing,
    onClear,
}: {
    alerts: ReadonlyArray<LoggedAlert>;
    /** Whether the angle is still over the limit of the latest alert. */
    isLatestOngoing: boolean;
    onClear: () => void;
}): React.JSX.Element {
    return (
        <ViewerPanel style={ALERT_LIST_STYLE}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>Alerts · {alerts.length}</span>
                <Button variant="ghost" size="sm" onClick={onClear}>
                    Clear
                </Button>
            </header>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", overflowY: "auto" }}>
                {alerts.map((alert, index) => (
                    <li
                        key={alert.id}
                        style={{
                            ...ALERT_ROW_STYLE,
                            borderTop: index > 0 ? "1px solid var(--3dverse-color-border-secondary)" : undefined,
                        }}
                    >
                        <span style={{ color: LEVEL_COLORS[alert.level], fontWeight: 600 }}>
                            {ANGLE_ZONE_LEVEL_LABELS[alert.level]}
                        </span>
                        <time dateTime={alert.time.toISOString()} style={SECONDARY_TEXT_STYLE}>
                            {alert.time.toLocaleTimeString()}
                        </time>
                        <span>
                            {Math.round(alert.angleDeg)}° over {formatSeconds(alert.holdLimitS)}
                        </span>
                        <span style={SECONDARY_TEXT_STYLE}>{index === 0 && isLatestOngoing ? "Ongoing" : ""}</span>
                    </li>
                ))}
            </ol>
        </ViewerPanel>
    );
}

const ALERT_LIST_STYLE: React.CSSProperties = {
    position: "absolute",
    top: "1rem",
    right: "1rem",
    flexDirection: "column",
    gap: "0.25rem",
    width: "16rem",
    maxHeight: "calc(100% - 2rem)",
    padding: "0.5rem 0.75rem",
    color: "var(--3dverse-color-content-primary)",
    fontSize: "0.8125rem",
    fontVariantNumeric: "tabular-nums",
};

const ALERT_ROW_STYLE: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    columnGap: "0.5rem",
    padding: "0.375rem 0",
};

const SECONDARY_TEXT_STYLE: React.CSSProperties = {
    color: "var(--3dverse-color-content-secondary)",
    textAlign: "right",
};

//------------------------------------------------------------------------------
/**
 * Angle of the joint: `controlAngleDeg`, or, while the rotation plays, a swing of `ROTATION_AMPLITUDE_DEG` either
 * side, held where it was paused. Moving the control stops the rotation, which then resumes from the angle set.
 */
function useRotation(controlAngleDeg: number): {
    angleDeg: number;
    isRotating: boolean;
    toggleRotation: () => void;
} {
    const [angleDeg, setAngleDeg] = useState(controlAngleDeg);
    const [isRotating, setIsRotating] = useState(false);
    /** Phase of the swing, kept while paused to resume in the same direction. */
    const phaseRef = useRef(0);

    useEffect(() => {
        setIsRotating(false);
        setAngleDeg(controlAngleDeg);
        phaseRef.current = Math.asin(Math.max(-1, Math.min(1, controlAngleDeg / ROTATION_AMPLITUDE_DEG)));
    }, [controlAngleDeg]);

    useEffect(() => {
        if (!isRotating) {
            return;
        }

        let frameId = 0;
        let previousTime: number | null = null;
        const step = (time: number): void => {
            if (previousTime !== null) {
                phaseRef.current += (2 * Math.PI * (time - previousTime)) / (ROTATION_PERIOD_SEC * 1000);
            }
            previousTime = time;
            setAngleDeg(ROTATION_AMPLITUDE_DEG * Math.sin(phaseRef.current));
            frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);

        return (): void => cancelAnimationFrame(frameId);
    }, [isRotating]);

    return { angleDeg, isRotating, toggleRotation: () => setIsRotating(previous => !previous) };
}

//------------------------------------------------------------------------------
/**
 * Orientation of the entity turned by `angleDeg` around `planeNormal`, from `referenceDirection`: its vertical is
 * tilted onto `planeNormal`, then it is turned around it, from its forward, to `referenceDirection`, plus `angleDeg`.
 * In the default plane, it is only turned around the vertical by `angleDeg`.
 */
function jointOrientation(planeNormal: Vec3, referenceDirection: Vec3, angleDeg: number): Quat {
    const normal = normalize(planeNormal);
    // The shortest way, or around any horizontal axis when the normal points down.
    const tiltAxis = cross(UP, normal);
    const tilt = axisAngleToQuat(
        length(tiltAxis) > 1e-6 ? normalize(tiltAxis) : [1, 0, 0],
        angleBetweenDeg(UP, normal),
    );
    const twistDeg = signedAngleDeg(rotateVec3(tilt, FORWARD), reject(referenceDirection, normal), normal);
    return multiplyQuat(axisAngleToQuat(normal, twistDeg + angleDeg), tilt);
}

/**
 * Aims the orbital camera controller at the entity, from `CAMERA_POSITION`. Declared once so that the ref callback
 * isn't called again on every render.
 */
function lookAtTarget(cameraController: DefaultCameraController | undefined | null): void {
    cameraController?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false);
}

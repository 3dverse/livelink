//------------------------------------------------------------------------------
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Vec3 } from "@3dverse/livelink";
import {
    CameraController,
    Canvas,
    DefaultCameraController,
    DOM3DAnchor,
    DOM3DOverlay,
    useCameraEntity,
    Viewport,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DOM3DAngle } from "../../components/DOM3DAngle";
import { useAngleExposure, type AngleExposureAlert } from "../../components/DOM3DAngle/useAngleExposure";
import { Button } from "../../components-common/Button";
import { SKELETON_SCENE_ID } from "../../../.storybook/sceneIds";
import { NEUTRAL_POSTURE, type BodyPosture } from "./bodyRig";
import {
    BACK_BENDING_RULES,
    SCENARIO,
    TRUNK_INCLINATION_SCALE_RANGE,
    listAggravatingFactors,
    spinePoints,
    type AggravatingFactor,
    type ScenarioStep,
} from "./backBending";
import { AlertBanner, MonitorPanel } from "./panels";
import { Readout } from "./Readout";
import { SpineCurve } from "./SpineCurve";
import { above, useMeasuredBody } from "./useMeasuredBody";
import { usePostureTransition } from "./usePostureTransition";

//------------------------------------------------------------------------------
/** Sees the robot from its left, slightly from the front: forward bends read in profile. */
const SIDE_CAMERA_POSITION: Vec3 = [2.4, 1.2, 1.0];
/** Sees the robot from the front, slightly from its left: forward bends come toward the camera. */
const FRONT_CAMERA_POSITION: Vec3 = [0.5, 1.3, 2.7];
const CAMERA_TARGET: Vec3 = [0, 0.85, 0.1];

const TRANSITION_MS = 1000;
/** Alerts raised earlier today, before the story started, so that the first one reads "3 times today". */
const ALERTS_EARLIER_TODAY = 2;
const BANNER_LINGER_MS = 4000;
/** Height of the bottom of the alert banner above the head of the robot standing, in meters. */
const BANNER_HEIGHT_ABOVE_HEAD = 0.35;

//------------------------------------------------------------------------------
type BackBendingMonitorArgs = BodyPosture & {
    /** Plays a scenario of bends in a loop, or holds the posture set below. */
    mode: "scenario" | "manual";
    /** Weight in the hands, declared by the task: a body capture doesn't measure it. */
    loadKg: number;
    /** Seconds a bend over 60° can be held. ISO 11226 and EN 1005-4 call a posture held over 4 s static. */
    staticLimitS: number;
    /** Seconds a bend between 20° and 60° can be held. ISO 11226 gives it by angle: 60 s is indicative. */
    conditionalLimitS: number;
    /** Accuracy of the body capture, in degrees, shown around the needle. */
    uncertaintyDeg: number;
    /** Shows the readout beside the hips. Without it, the value and the time held are written above the spine. */
    showReadout: boolean;
    /** Draws the spine, from the hips to the base of the neck, through its pivots at the waist and the chest. */
    showSpine: boolean;
    /** Shows the needle, the straight trunk line from the hip joint center to the base of the neck. */
    showNeedle: boolean;
    /** Where the camera starts, before orbiting. */
    view: "side" | "front";
};

const isManual = { arg: "mode", eq: "manual" } as const;

const meta = {
    title: "Examples/Back Bending Monitor",
    id: "examples-back-bending-monitor",
    parameters: {
        layout: "fullscreen",
        livelinkSceneId: SKELETON_SCENE_ID,
    },
    args: {
        mode: "scenario",
        ...NEUTRAL_POSTURE,
        loadKg: 0,
        staticLimitS: BACK_BENDING_RULES.holdLimits.notAcceptable,
        conditionalLimitS: BACK_BENDING_RULES.holdLimits.conditional,
        uncertaintyDeg: 5,
        showReadout: true,
        showSpine: true,
        showNeedle: false,
        view: "side",
    },
    argTypes: {
        mode: { control: "radio", options: ["scenario", "manual"] },
        pelvisTiltDeg: { control: { type: "range", min: -20, max: 70, step: 1 }, if: isManual },
        lumbarFlexionDeg: { control: { type: "range", min: -20, max: 50, step: 1 }, if: isManual },
        thoracicFlexionDeg: { control: { type: "range", min: -20, max: 50, step: 1 }, if: isManual },
        kneeFlexionDeg: { control: { type: "range", min: 0, max: 110, step: 1 }, if: isManual },
        twistDeg: { control: { type: "range", min: -45, max: 45, step: 1 }, if: isManual },
        loadKg: { control: { type: "range", min: 0, max: 25, step: 1 }, if: isManual },
        staticLimitS: { control: { type: "range", min: 1, max: 10, step: 1 } },
        conditionalLimitS: { control: { type: "range", min: 5, max: 120, step: 5 } },
        uncertaintyDeg: { control: { type: "range", min: 0, max: 10, step: 1 } },
        view: { control: "radio", options: ["side", "front"] },
    },
} satisfies Meta<BackBendingMonitorArgs>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<BackBendingMonitorArgs>;

//------------------------------------------------------------------------------
/**
 * A worker tracked by a body capture bends over, and the monitor assesses each bend the way an ergonomist or an
 * osteopath would:
 *
 * - **The angle**: the inclination of the trunk line, from the hip joints to the base of the neck, from the
 *   vertical: what the lower back holds against gravity, whether the bend comes from the hips or from the spine.
 *   EN 1005-4 and ISO 11226 rate it acceptable up to 20°, conditionally acceptable up to 60°, not acceptable
 *   beyond.
 * - **The duration**: a posture held over 4 s is static. Over 60°, a static bend raises an alert.
 * - **The frequency**: bending twice a minute or more is a high frequency.
 * - **What aggravates it**: a rounded lower back rather than a hinge at the hips, straight knees, a load in the
 *   hands, a twist or a side bend.
 *
 * The scenario goes through a hip hinge, back straight and knees bent, a stoop lifting 12 kg with a rounded back
 * and straight knees, and a bend with a twist. Switch to manual to set the posture yourself.
 *
 * The spine is drawn from the vertex of the trunk inclination, the hip joint center, through its pivots at the hips,
 * the waist and the chest, to the base of the neck, in the color of the zone of the trunk inclination. It is also the
 * progress bar of the time held: in a zone with a hold limit, it fills from the hips to the neck, then pulses once the
 * limit is reached. Show the needle to compare the spine with the straight trunk line: the gap is a rounded back.
 *
 * The thresholds are indicative screening values from the standards, not a diagnosis: see the Docs page.
 */
export const Default: Story = {
    render: args => <BackBendingMonitor {...args} />,
};

//------------------------------------------------------------------------------
/**
 * Seen from the front, the gauge is edge-on and fades out, while the spine, drawn facing the camera, keeps reading:
 * in the color of the zone, filling from the hips to the neck with the time held. Without the readout, the value and
 * the time held are written above it.
 */
export const FrontView: Story = {
    args: { view: "front", showReadout: false },
    render: args => <BackBendingMonitor {...args} />,
};

//------------------------------------------------------------------------------
function BackBendingMonitor({
    mode,
    pelvisTiltDeg,
    lumbarFlexionDeg,
    thoracicFlexionDeg,
    kneeFlexionDeg,
    twistDeg,
    loadKg: manualLoadKg,
    staticLimitS,
    conditionalLimitS,
    uncertaintyDeg,
    showReadout,
    showSpine,
    showNeedle,
    view,
}: BackBendingMonitorArgs): React.JSX.Element {
    const cameraPosition = view === "front" ? FRONT_CAMERA_POSITION : SIDE_CAMERA_POSITION;
    const { cameraEntity } = useCameraEntity({ position: cameraPosition });
    // The orbital camera controller orbits around a target, the origin by default, so it is aimed at the robot
    // instead. Memoized so that the ref callback is only called again when the view changes.
    const lookAtRobot = useCallback(
        (cameraController: DefaultCameraController | undefined | null): void => {
            cameraController?.setLookAt(...cameraPosition, ...CAMERA_TARGET, false);
        },
        [cameraPosition],
    );
    const { posture, transitionTo } = usePostureTransition(NEUTRAL_POSTURE, TRANSITION_MS);

    const [isPlaying, setIsPlaying] = useState(true);
    const isScenario = mode === "scenario";
    const step = useScenario(isScenario && isPlaying, transitionTo);
    useEffect(() => {
        if (!isScenario) {
            transitionTo({ pelvisTiltDeg, lumbarFlexionDeg, thoracicFlexionDeg, kneeFlexionDeg, twistDeg });
        }
    }, [isScenario, pelvisTiltDeg, lumbarFlexionDeg, thoracicFlexionDeg, kneeFlexionDeg, twistDeg, transitionTo]);
    const loadKg = isScenario ? step.loadKg : manualLoadKg;

    const { isPending, isFound, landmarks, measurement, standingLandmarks } = useMeasuredBody(posture);

    const [lastAlert, setLastAlert] = useState<{ alert: AngleExposureAlert; factors: Array<AggravatingFactor> } | null>(
        null,
    );
    const factorsRef = useRef<Array<AggravatingFactor>>([]);
    const exposure = useAngleExposure({
        angleDeg: measurement?.trunkInclinationDeg ?? 0,
        zones: BACK_BENDING_RULES.zones,
        holdLimits: { conditional: conditionalLimitS, notAcceptable: staticLimitS },
        onAlert: alert => setLastAlert({ alert, factors: factorsRef.current }),
    });
    const factors = measurement
        ? listAggravatingFactors({
              posture: measurement,
              level: exposure.level,
              loadKg,
              bendsPerMinute: exposure.excursionsPerMinute,
          })
        : [];
    useEffect(() => {
        factorsRef.current = factors;
    });

    const alertsToday = ALERTS_EARLIER_TODAY + exposure.alertCount;
    const isBannerVisible = useLingeringFlag(exposure.status === "alert", BANNER_LINGER_MS);

    if (!isPending && !isFound) {
        console.error("The robot bones or its animation controller couldn't be found in the scene");
    }

    return (
        <Canvas style={{ width: "100%", height: "100vh" }}>
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController ref={lookAtRobot} />
                {landmarks && measurement && standingLandmarks && (
                    <DOM3DOverlay>
                        <DOM3DAngle
                            worldPosition={measurement.hipCenter}
                            planeNormal={measurement.lateralAxis}
                            angleDeg={measurement.trunkInclinationDeg}
                            zones={BACK_BENDING_RULES.zones}
                            exposure={exposure}
                            needleLength={measurement.trunkLength}
                            scaleRange={TRUNK_INCLINATION_SCALE_RANGE}
                            uncertaintyDeg={uncertaintyDeg}
                            showNeedle={showNeedle}
                        >
                            {showReadout && (
                                <Readout
                                    label="Trunk inclination"
                                    angleDeg={measurement.trunkInclinationDeg}
                                    uncertaintyDeg={uncertaintyDeg}
                                    exposure={exposure}
                                    zones={BACK_BENDING_RULES.zones}
                                    scaleRange={TRUNK_INCLINATION_SCALE_RANGE}
                                />
                            )}
                        </DOM3DAngle>
                        {showSpine && (
                            // After the gauge, so that it is drawn over it, and over the needle.
                            <SpineCurve
                                hipCenter={measurement.hipCenter}
                                spinePoints={spinePoints(landmarks)}
                                angleDeg={measurement.trunkInclinationDeg}
                                exposure={exposure}
                                showValue={!showReadout}
                            />
                        )}
                        <DOM3DAnchor
                            worldPosition={above(standingLandmarks.head, BANNER_HEIGHT_ABOVE_HEAD)}
                            offset="center-bottom"
                            style={{ pointerEvents: "none" }}
                        >
                            <AlertBanner
                                isVisible={isBannerVisible && lastAlert !== null}
                                alertsToday={alertsToday}
                                alert={lastAlert?.alert ?? null}
                                factors={lastAlert?.factors ?? []}
                            />
                        </DOM3DAnchor>
                    </DOM3DOverlay>
                )}
                {measurement && (
                    <MonitorPanel
                        posture={measurement}
                        exposure={exposure}
                        loadKg={loadKg}
                        alertsToday={alertsToday}
                        uncertaintyDeg={uncertaintyDeg}
                    />
                )}
                {isScenario && (
                    <div style={TOOLBAR_STYLE}>
                        <Button
                            variant="secondary"
                            size="sm"
                            aria-pressed={isPlaying}
                            onClick={() => setIsPlaying(previous => !previous)}
                            style={{ backgroundColor: "var(--3dverse-color-bg-overground)" }}
                        >
                            {isPlaying ? "Pause" : "Play"}
                        </Button>
                        <span style={CAPTION_STYLE}>{step.caption}</span>
                    </div>
                )}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
const TOOLBAR_STYLE: React.CSSProperties = {
    position: "absolute",
    top: "1rem",
    left: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
};

const CAPTION_STYLE: React.CSSProperties = {
    padding: "0.375rem 0.75rem",
    borderRadius: "0.375rem",
    backgroundColor: "color-mix(in srgb, var(--3dverse-color-bg-foreground) 85%, transparent)",
    color: "var(--3dverse-color-content-primary)",
    fontSize: "0.8125rem",
};

//------------------------------------------------------------------------------
/** Plays `SCENARIO` in a loop while `isPlaying`, from its start, and returns the step playing. */
function useScenario(isPlaying: boolean, transitionTo: (posture: BodyPosture) => void): ScenarioStep {
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        if (!isPlaying) {
            return;
        }

        let index = 0;
        let timeoutId = 0;
        const playStep = (): void => {
            const step = SCENARIO[index]!;
            setStepIndex(index);
            transitionTo(step.posture);
            index = (index + 1) % SCENARIO.length;
            timeoutId = window.setTimeout(playStep, TRANSITION_MS + step.holdMs);
        };
        playStep();

        return (): void => window.clearTimeout(timeoutId);
    }, [isPlaying, transitionTo]);

    return SCENARIO[stepIndex]!;
}

/** True while `isActive`, and for `lingerMs` after. */
function useLingeringFlag(isActive: boolean, lingerMs: number): boolean {
    const [isLingering, setIsLingering] = useState(false);
    const wasActiveRef = useRef(isActive);

    useEffect(() => {
        const wasActive = wasActiveRef.current;
        wasActiveRef.current = isActive;
        if (isActive || !wasActive) {
            return;
        }

        setIsLingering(true);
        const timeoutId = window.setTimeout(() => setIsLingering(false), lingerMs);
        return (): void => window.clearTimeout(timeoutId);
    }, [isActive, lingerMs]);

    return isActive || isLingering;
}

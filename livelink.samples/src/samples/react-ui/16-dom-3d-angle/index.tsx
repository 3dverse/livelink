//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { folder, useControls } from "leva";
import { MathUtils, Quaternion, Vector3 } from "three";

//------------------------------------------------------------------------------
import type { Quat, Vec3 } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    DOM3DOverlay,
    useCameraEntity,
    useEntity,
} from "@3dverse/livelink-react";
import {
    LoadingOverlay,
    DOM3DAngle,
    useAngleExposure,
    ANGLE_ZONE_LEVEL_LABELS,
    type AngleExposure,
    type AngleHoldLimits,
    type AngleZone,
    type AngleZoneLevel,
    type DOM3DAngleProps,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, json } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "505ba29e-3789-458d-8918-5815514f6ede";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

/** Entity turned around the vertical, as the link of a joint would be. */
const joint_euid = "c1c2ecff-247e-4066-86f0-e4fd3471c385";

/** High enough for the gauge, lying flat, not to fade out edge-on. */
const camera_position: Vec3 = [2.4, 2.8, 2.4];
const camera_target: Vec3 = [0, 0, 0];

/**
 * Working range of the joint: free within ±60°, for a limited time up to
 * ±90°, never beyond.
 */
const joint_zones: Array<AngleZone> = [
    { min: Number.NEGATIVE_INFINITY, max: -90, level: "notAcceptable" },
    { min: -90, max: -60, level: "conditional" },
    { min: -60, max: 60, level: "acceptable" },
    { min: 60, max: 90, level: "conditional" },
    { min: 90, max: Number.POSITIVE_INFINITY, level: "notAcceptable" },
];

/** Seconds the joint can stay in each zone before the alert. */
const hold_limits: AngleHoldLimits = { conditional: 5, notAcceptable: 2 };

const initial_angle_deg = 40;

const sector_colorings: Array<NonNullable<DOM3DAngleProps["sectorColoring"]>> =
    ["zones", "currentZone"];

/** The swing takes the joint across all its zones, and back. */
const swing_amplitude_deg = 110;
const swing_period_s = 12;

const level_text_colors: Record<AngleZoneLevel, string> = {
    acceptable: "text-green-400",
    conditional: "text-amber-400",
    notAcceptable: "text-red-400",
};

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
    const { entity: joint } = useEntity({ euid: joint_euid });
    const { angleDeg, setAngleDeg, isSwinging, toggleSwing } =
        useJointAngle(initial_angle_deg);

    // Every prop of the gauge, as in its stories, passed as it is. The objects
    // are shown as JSON, to edit as text.
    const [{ exposure: isExposurePassed, ...gaugeProps }, setControls] =
        useControls(() => ({
            angleDeg: {
                value: initial_angle_deg,
                min: -150,
                max: 150,
                step: 1,
                // Called when the swing moves the slider too: only a drag sets the
                // angle.
                onChange: (value: number, _path, { fromPanel }) => {
                    if (fromPanel) setAngleDeg(value);
                },
            },
            Plane: folder({
                worldPosition: { value: [0, 0, 0], step: 0.1 },
                planeNormal: { value: [0, 1, 0], step: 0.1 },
                referenceDirection: { value: [0, 0, 1], step: 0.1 },
            }),
            Gauge: folder({
                size: { value: 0.6, min: 0.2, max: 1, step: 0.05 },
                scaleRange: {
                    value: [-120, 120],
                    min: -180,
                    max: 180,
                    step: 5,
                },
                scaleFadeDeg: { value: 70, min: 0, max: 90, step: 5 },
                showScaleValues: true,
                showAngleValue: true,
            }),
            Needle: folder({
                showNeedle: true,
                // Unset, it is 1.25 times the size.
                needleLength: {
                    value: 0.75,
                    min: 0.2,
                    max: 1,
                    step: 0.05,
                    optional: true,
                    disabled: true,
                },
                uncertaintyDeg: { value: 0, min: 0, max: 10, step: 1 },
            }),
            Zones: folder({
                zones: json({ value: joint_zones, optional: true }),
                sectorColoring: {
                    options: sector_colorings,
                    hint: "Shows once the angle crosses a zone, e.g. at 100°: the angle filled zone by zone, or all in the color of the current one.",
                },
                holdLimits: json({ value: hold_limits, optional: true }),
                // Timed by `useAngleExposure` below, and shown as it goes: given to
                // the gauge, it takes the place of `holdLimits`.
                exposure: json<AngleExposure | null>({
                    value: null,
                    editable: false,
                    optional: true,
                }),
            }),
        }));

    // The gauge starts at the joint, once it is loaded.
    useEffect(() => {
        if (joint) {
            setControls({
                worldPosition: [...joint.global_transform.position] as Vec3,
            });
        }
    }, [joint, setControls]);

    // The slider follows the joint while it swings.
    useEffect(() => {
        setControls({ angleDeg: Math.round(angleDeg) });
    }, [angleDeg, setControls]);

    // Turns the joint by the angle, in the plane of the gauge.
    const { planeNormal, referenceDirection, zones, holdLimits } = gaugeProps;
    useEffect(() => {
        if (joint) {
            joint.local_transform = {
                orientation: jointOrientation(
                    planeNormal,
                    referenceDirection,
                    angleDeg,
                ),
            };
        }
    }, [joint, planeNormal, referenceDirection, angleDeg]);

    // Times the angle against the zones, for the status under the gauge. The
    // hook needs zones: without any, it goes on timing the joint's.
    const exposure = useAngleExposure({
        angleDeg,
        zones: zones?.length ? zones : joint_zones,
        holdLimits: holdLimits ?? {},
    });

    // The panel shows the exposure as it goes.
    useEffect(() => {
        setControls({ exposure });
    }, [exposure, setControls]);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController ref={lookAtJoint} />
                {joint && (
                    <DOM3DOverlay>
                        <DOM3DAngle
                            {...gaugeProps}
                            angleDeg={angleDeg}
                            exposure={
                                zones && isExposurePassed !== undefined
                                    ? exposure
                                    : undefined
                            }
                        >
                            {zones && <ExposureStatus exposure={exposure} />}
                        </DOM3DAngle>
                    </DOM3DOverlay>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                    <button
                        className="button button-overlay"
                        aria-pressed={isSwinging}
                        onClick={toggleSwing}
                    >
                        {isSwinging ? "Pause swing" : "Play swing"}
                    </button>
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
/**
 * Orientation of the joint turned by `angleDeg` in the plane of the gauge: its
 * vertical tilted onto `planeNormal`, then turned around it, from its forward to
 * `referenceDirection`, and on by the angle. In the default plane, it is only
 * turned around the vertical by the angle.
 */
function jointOrientation(
    planeNormal: Vec3,
    referenceDirection: Vec3,
    angleDeg: number,
): Quat {
    const normal = new Vector3(...planeNormal).normalize();
    const tilt = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        normal,
    );
    const forward = new Vector3(0, 0, 1).applyQuaternion(tilt);
    const reference = new Vector3(...referenceDirection).projectOnPlane(normal);
    const twist = Math.atan2(
        new Vector3().crossVectors(forward, reference).dot(normal),
        forward.dot(reference),
    );
    return new Quaternion()
        .setFromAxisAngle(normal, twist + MathUtils.degToRad(angleDeg))
        .multiply(tilt)
        .toArray() as Quat;
}

//------------------------------------------------------------------------------
/**
 * The orbital camera controller orbits around the origin by default: it is
 * aimed at the joint from above. Declared once so that the ref callback isn't
 * called again on every render.
 */
function lookAtJoint(controller: DefaultCameraController | undefined | null) {
    controller?.setLookAt(...camera_position, ...camera_target, false);
}

//------------------------------------------------------------------------------
/**
 * The zone the joint is in, how long it has been held there against its
 * limit, and the alerts raised since the sample started.
 */
function ExposureStatus({ exposure }: { exposure: AngleExposure }) {
    return (
        <div className="w-56 px-3 py-2 text-white bg-black/70 rounded-md backdrop-blur-md">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-px text-2xs tabular-nums">
                <dt className="text-white/60">Zone</dt>
                <dd className={level_text_colors[exposure.level]}>
                    {ANGLE_ZONE_LEVEL_LABELS[exposure.level]}
                </dd>
                <dt className="text-white/60">Held</dt>
                <dd>
                    {exposure.level === "acceptable"
                        ? "—"
                        : `${exposure.holdS.toFixed(1)} s` +
                          (exposure.holdLimitS !== null
                              ? ` / ${exposure.holdLimitS} s`
                              : "")}
                </dd>
                <dt className="text-white/60">Alerts</dt>
                <dd
                    className={
                        exposure.status === "alert" ? "text-red-400" : ""
                    }
                >
                    {exposure.alertCount}
                </dd>
            </dl>
        </div>
    );
}

//------------------------------------------------------------------------------
/**
 * The angle of the joint: set by hand, or swinging back and forth across all
 * its zones while playing. Setting it by hand stops the swing, which then
 * resumes from there.
 */
function useJointAngle(initialAngleDeg: number) {
    const [angleDeg, setAngleDeg] = useState(initialAngleDeg);
    const [isSwinging, setIsSwinging] = useState(false);
    // Phase of the swing, kept while paused, to resume where it was.
    const phaseRef = useRef(swingPhaseAt(initialAngleDeg));

    useEffect(() => {
        if (!isSwinging) {
            return;
        }
        let frameId = 0;
        let previousTime: number | null = null;
        const step = (time: number) => {
            if (previousTime !== null) {
                phaseRef.current +=
                    (2 * Math.PI * (time - previousTime)) /
                    (swing_period_s * 1000);
            }
            previousTime = time;
            setAngleDeg(swing_amplitude_deg * Math.sin(phaseRef.current));
            frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frameId);
    }, [isSwinging]);

    return {
        angleDeg,
        isSwinging,
        toggleSwing: () => setIsSwinging(previous => !previous),
        setAngleDeg: (value: number) => {
            setIsSwinging(false);
            setAngleDeg(value);
            phaseRef.current = swingPhaseAt(value);
        },
    };
}

/** Phase of the swing at an angle, on its way up. */
function swingPhaseAt(angleDeg: number) {
    const ratio = angleDeg / swing_amplitude_deg;
    return Math.asin(Math.max(-1, Math.min(1, ratio)));
}

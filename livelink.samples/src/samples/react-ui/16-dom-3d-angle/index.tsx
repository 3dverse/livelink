//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";
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
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

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
        useJointAngle(40);

    const [showZones, setShowZones] = useState(true);
    const [showNeedle, setShowNeedle] = useState(true);
    const [showScaleValues, setShowScaleValues] = useState(true);

    // Turns the joint by the angle, around the vertical.
    useEffect(() => {
        if (joint) {
            joint.local_transform = { eulerOrientation: [0, angleDeg, 0] };
        }
    }, [joint, angleDeg]);

    // Times the angle against the zones. The gauge could do it by itself,
    // given `holdLimits`: timed here, the exposure is shown in the panel too.
    const exposure = useAngleExposure({
        angleDeg,
        zones: joint_zones,
        holdLimits: hold_limits,
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController ref={lookAtJoint} />
                {joint && (
                    <DOM3DOverlay>
                        <DOM3DAngle
                            worldPosition={
                                [...joint.global_transform.position] as Vec3
                            }
                            planeNormal={[0, 1, 0]}
                            referenceDirection={[0, 0, 1]}
                            angleDeg={angleDeg}
                            zones={showZones ? joint_zones : undefined}
                            exposure={showZones ? exposure : undefined}
                            size={0.6}
                            scaleRange={[-120, 120]}
                            showNeedle={showNeedle}
                            showScaleValues={showScaleValues}
                        />
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
                <div className="absolute right-3 bottom-3 w-72 rounded-md bg-black/70 p-3 text-white backdrop-blur-sm">
                    <h3 className="mb-2 text-sm font-semibold">DOM3DAngle</h3>
                    <label className="mb-2 block text-xs">
                        <span className="mb-1 block">
                            Angle: {Math.round(angleDeg)}°
                        </span>
                        <input
                            className="w-full"
                            type="range"
                            min={-150}
                            max={150}
                            step={1}
                            value={Math.round(angleDeg)}
                            onChange={event =>
                                setAngleDeg(Number(event.target.value))
                            }
                        />
                    </label>
                    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <Checkbox
                            label="Zones"
                            checked={showZones}
                            onChange={setShowZones}
                        />
                        <Checkbox
                            label="Needle"
                            checked={showNeedle}
                            onChange={setShowNeedle}
                        />
                        <Checkbox
                            label="Scale values"
                            checked={showScaleValues}
                            onChange={setShowScaleValues}
                        />
                    </div>
                    {showZones && <ExposureStatus exposure={exposure} />}
                </div>
            </Viewport>
        </Canvas>
    );
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
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-white/20 pt-2 text-xs tabular-nums">
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
            <dd className={exposure.status === "alert" ? "text-red-400" : ""}>
                {exposure.alertCount}
            </dd>
        </dl>
    );
}

//------------------------------------------------------------------------------
function Checkbox({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-2">
            <input
                type="checkbox"
                checked={checked}
                onChange={event => onChange(event.target.checked)}
            />
            {label}
        </label>
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

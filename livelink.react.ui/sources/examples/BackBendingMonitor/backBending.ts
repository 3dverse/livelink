//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import type { AngleZone, AngleZoneLevel } from "../../components/DOM3DAngle";
import type { AngleHoldLimits } from "../../components/DOM3DAngle/useAngleExposure";
import { NEUTRAL_POSTURE, type BodyLandmarks, type BodyPosture } from "./bodyRig";
import type { TrunkPosture } from "./trunkPosture";

//------------------------------------------------------------------------------
/**
 * Zones of trunk inclination of EN 1005-4 and ISO 11226: the angle of the trunk line, from the hip joints
 * to the base of the neck (C7), from the vertical, positive forward.
 * - Up to 20°: acceptable.
 * - 20° to 60°: conditionally acceptable, depending on how long and how often it is held, and on support.
 * - Over 60°: not acceptable.
 * - Leaning backward is only acceptable with the trunk supported. It becomes conditionally acceptable past 10°,
 *   a margin for the accuracy of the measurement and for the sway of standing.
 */
export const TRUNK_INCLINATION_ZONES: ReadonlyArray<AngleZone> = [
    { min: Number.NEGATIVE_INFINITY, max: -10, level: "conditional" },
    { min: -10, max: 20, level: "acceptable" },
    { min: 20, max: 60, level: "conditional" },
    { min: 60, max: Number.POSITIVE_INFINITY, level: "notAcceptable" },
];

/** Inclinations shown on the gauge and the meter of the readout: a little backward, and forward past horizontal. */
export const TRUNK_INCLINATION_SCALE_RANGE: readonly [min: number, max: number] = [-30, 120];

/**
 * Criteria of a harmful back bend. The trunk inclination is the main one, assessed by zone, by how long it is
 * held and by how often it happens; the others make a bend more harmful.
 */
export const BACK_BENDING_RULES = {
    /** Zones of trunk inclination of EN 1005-4 and ISO 11226: 0–20° acceptable, 20–60° conditional, over 60° not. */
    zones: TRUNK_INCLINATION_ZONES,
    /**
     * Over 60°, a bend held for more than 4 s, which ISO 11226 and EN 1005-4 call a static posture, isn't
     * acceptable. Between 20° and 60°, ISO 11226 gives the maximum holding time by angle: 60 s is an indicative
     * default.
     */
    holdLimits: { conditional: 60, notAcceptable: 4 } satisfies AngleHoldLimits,
    /** EN 1005-4: bending twice a minute or more is a high frequency. */
    maxBendsPerMinute: 2,
    /**
     * Lumbar flexion over which the back counts as rounded: about half of the usual range of the lumbar spine.
     * Near the end of that range, the muscles of the back relax and the discs and ligaments carry the load.
     * Indicative: the range differs from one person to the next, measure it when calibrating.
     */
    roundedBackDeg: 30,
    /**
     * Thoracic flexion over which the upper back counts as hunched. Indicative: it loads the neck and the shoulders
     * more than the lower back, so it is shown but doesn't make a bend more harmful for the lower back.
     */
    hunchedUpperBackDeg: 30,
    /** Knee flexion under which a bend counts as a stoop, legs straight, rather than a squat. */
    straightKneesDeg: 20,
    /** REBA scores loads from 5 kg up, and gives its highest load score over 10 kg. */
    loadKg: 5,
    /** Twist or side bend while bending over which the trunk counts as asymmetric. */
    asymmetryDeg: 10,
} as const;

export const BACK_BENDING_REFERENCES =
    "Zones: EN 1005-4, ISO 11226 · Static posture: held over 4 s · Load and asymmetry: REBA";

//------------------------------------------------------------------------------
export type AggravatingFactor = {
    id: "roundedBack" | "straightKnees" | "load" | "asymmetry" | "frequency";
    label: string;
    value: string;
};

/**
 * What makes the current bend more harmful than its inclination alone: a rounded back, straight knees, a load, an
 * asymmetric trunk, a high frequency.
 */
export function listAggravatingFactors({
    posture,
    level,
    loadKg,
    bendsPerMinute,
}: {
    posture: TrunkPosture;
    level: AngleZoneLevel;
    loadKg: number;
    bendsPerMinute: number;
}): Array<AggravatingFactor> {
    const rules = BACK_BENDING_RULES;
    const isBending = level !== "acceptable";
    const factors: Array<AggravatingFactor> = [];

    if (posture.lumbarFlexionDeg >= rules.roundedBackDeg) {
        factors.push({
            id: "roundedBack",
            label: "Rounded back",
            value: `lumbar ${formatDeg(posture.lumbarFlexionDeg)}`,
        });
    }
    if (isBending && posture.kneeFlexionDeg < rules.straightKneesDeg) {
        factors.push({ id: "straightKnees", label: "Straight knees", value: formatDeg(posture.kneeFlexionDeg) });
    }
    if (loadKg >= rules.loadKg) {
        factors.push({ id: "load", label: "Load", value: `${loadKg} kg` });
    }
    const isTwisted = Math.abs(posture.twistDeg) >= Math.abs(posture.lateralBendDeg);
    const asymmetryDeg = isTwisted ? posture.twistDeg : posture.lateralBendDeg;
    if (isBending && Math.abs(asymmetryDeg) >= rules.asymmetryDeg) {
        factors.push({
            id: "asymmetry",
            label: isTwisted ? "Twisted" : "Side-bent",
            value: formatDeg(Math.abs(asymmetryDeg)),
        });
    }
    if (bendsPerMinute >= rules.maxBendsPerMinute) {
        factors.push({ id: "frequency", label: "Frequent bending", value: `${formatRate(bendsPerMinute)}/min` });
    }

    return factors;
}

/**
 * The spine, from its base at the hips to the base of the neck, through its pivots at the waist and at the chest.
 */
export function spinePoints(landmarks: BodyLandmarks): ReadonlyArray<Vec3> {
    return [landmarks.spineBase, landmarks.waist, landmarks.chest, landmarks.neckBase];
}

export function formatDeg(angleDeg: number): string {
    return `${Math.round(angleDeg)}°`;
}

export function formatRate(perMinute: number): string {
    return perMinute < 10 ? perMinute.toFixed(1) : String(Math.round(perMinute));
}

//------------------------------------------------------------------------------
export type ScenarioStep = {
    caption: string;
    posture: BodyPosture;
    /** Weight in the hands, declared by the task: a body capture doesn't measure it. */
    loadKg: number;
    /** Time the posture is held, once reached. */
    holdMs: number;
};

/**
 * A worker going through bends of increasing harm, in a loop. A hip hinge and a stoop can have close trunk
 * inclinations, but not the same lumbar flexion.
 */
export const SCENARIO: ReadonlyArray<ScenarioStep> = [
    { caption: "Standing", posture: NEUTRAL_POSTURE, loadKg: 0, holdMs: 3000 },
    {
        caption: "Hip hinge: back straight, knees bent",
        posture: { pelvisTiltDeg: 38, lumbarFlexionDeg: 4, thoracicFlexionDeg: 2, kneeFlexionDeg: 55, twistDeg: 0 },
        loadKg: 0,
        holdMs: 5000,
    },
    { caption: "Standing", posture: NEUTRAL_POSTURE, loadKg: 0, holdMs: 2500 },
    {
        caption: "Stoop lifting 12 kg: rounded back, straight knees",
        posture: { pelvisTiltDeg: 40, lumbarFlexionDeg: 36, thoracicFlexionDeg: 18, kneeFlexionDeg: 6, twistDeg: 0 },
        loadKg: 12,
        holdMs: 7000,
    },
    { caption: "Standing", posture: NEUTRAL_POSTURE, loadKg: 0, holdMs: 3000 },
    {
        caption: "Bending and twisting",
        posture: { pelvisTiltDeg: 22, lumbarFlexionDeg: 16, thoracicFlexionDeg: 8, kneeFlexionDeg: 12, twistDeg: 28 },
        loadKg: 0,
        holdMs: 3500,
    },
    { caption: "Standing", posture: NEUTRAL_POSTURE, loadKg: 0, holdMs: 3000 },
];

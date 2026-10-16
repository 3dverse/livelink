//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { AngleExposure, AngleExposureAlert } from "../../components/DOM3DAngle/useAngleExposure";
import { ANGLE_ZONE_LEVEL_LABELS } from "../../components/DOM3DAngle/zones";
import { formatSeconds } from "../../components/DOM3DAngle/format";
import { ViewerPanel } from "../../components-common/ViewerPanel";
import {
    BACK_BENDING_REFERENCES,
    BACK_BENDING_RULES,
    formatDeg,
    formatRate,
    type AggravatingFactor,
} from "./backBending";
import type { TrunkPosture } from "./trunkPosture";
import styles from "./panels.module.css";

//------------------------------------------------------------------------------
type Tone = "ok" | "warning" | "danger";

const LEVEL_TONES: Record<AngleExposure["level"], Tone> = {
    acceptable: "ok",
    conditional: "warning",
    notAcceptable: "danger",
};

//------------------------------------------------------------------------------
/**
 * Every reading of the monitor, with its assessment, the exposure of the day, and the references the thresholds
 * come from.
 */
export function MonitorPanel({
    posture,
    exposure,
    loadKg,
    alertsToday,
    uncertaintyDeg,
}: {
    posture: TrunkPosture;
    exposure: AngleExposure;
    loadKg: number;
    alertsToday: number;
    uncertaintyDeg: number;
}): React.JSX.Element {
    const rules = BACK_BENDING_RULES;
    const isBending = exposure.level !== "acceptable";
    const isRounded = posture.lumbarFlexionDeg >= rules.roundedBackDeg;
    const isHunched = posture.thoracicFlexionDeg >= rules.hunchedUpperBackDeg;
    const areKneesStraight = posture.kneeFlexionDeg < rules.straightKneesDeg;
    const asymmetryDeg = Math.max(Math.abs(posture.twistDeg), Math.abs(posture.lateralBendDeg));
    const isAsymmetric = asymmetryDeg >= rules.asymmetryDeg;
    const isFrequent = exposure.excursionsPerMinute >= rules.maxBendsPerMinute;
    const holdTone: Tone =
        exposure.status === "alert" ? "danger" : exposure.holdLimitS !== null && isBending ? "warning" : "ok";

    return (
        <ViewerPanel className={styles.monitor}>
            <header className={styles.monitorHeader}>
                <span className={styles.monitorTitle}>Back bending monitor</span>
                <span className={styles.live}>Live</span>
            </header>

            <dl className={styles.readings}>
                <Reading
                    label="Trunk inclination"
                    value={`${formatDeg(posture.trunkInclinationDeg)}${uncertaintyDeg > 0 ? ` ±${uncertaintyDeg}°` : ""}`}
                    note={ANGLE_ZONE_LEVEL_LABELS[exposure.level]}
                    tone={LEVEL_TONES[exposure.level]}
                />
                <Reading
                    label="Held in zone"
                    value={
                        isBending
                            ? `${formatSeconds(exposure.holdS)}${exposure.holdLimitS !== null ? ` / ${formatSeconds(exposure.holdLimitS)}` : ""}`
                            : "—"
                    }
                    note={exposure.status === "alert" ? "Static, over limit" : isBending ? "Timing" : ""}
                    tone={holdTone}
                />
                <Reading
                    label="Lumbar flexion"
                    value={formatDeg(posture.lumbarFlexionDeg)}
                    note={isRounded ? "Rounded back" : "Neutral spine"}
                    tone={isRounded ? "danger" : "ok"}
                />
                <Reading
                    label="Thoracic flexion"
                    value={formatDeg(posture.thoracicFlexionDeg)}
                    note={isHunched ? "Hunched" : "Neutral"}
                    tone={isHunched ? "warning" : "ok"}
                />
                <Reading
                    label="Knee flexion"
                    value={formatDeg(posture.kneeFlexionDeg)}
                    note={areKneesStraight ? "Straight" : "Bent"}
                    tone={isBending && areKneesStraight ? "warning" : "ok"}
                />
                <Reading
                    label="Twist, side bend"
                    value={formatDeg(asymmetryDeg)}
                    note={isAsymmetric ? "Asymmetric" : "Symmetric"}
                    tone={isBending && isAsymmetric ? "warning" : "ok"}
                />
                <Reading
                    label="Load, declared"
                    value={loadKg > 0 ? `${loadKg} kg` : "None"}
                    note={loadKg > 10 ? "Heavy" : loadKg >= rules.loadKg ? "Moderate" : ""}
                    tone={loadKg > 10 ? "danger" : loadKg >= rules.loadKg ? "warning" : "ok"}
                />
                <Reading
                    label="Bending frequency"
                    value={`${formatRate(exposure.excursionsPerMinute)}/min`}
                    note={isFrequent ? "High" : "Low"}
                    tone={isFrequent ? "warning" : "ok"}
                />
            </dl>

            <section className={styles.today}>
                <span className={styles.sectionTitle}>Today</span>
                <span>
                    <strong>{alertsToday}</strong> {alertsToday === 1 ? "alert" : "alerts"}
                </span>
                <span>
                    <strong>{formatSeconds(exposure.timeByLevelS.notAcceptable)}</strong> over 60°
                </span>
                <span>
                    <strong>{exposure.excursionCount}</strong> bends
                </span>
            </section>

            <footer className={styles.footer}>{BACK_BENDING_REFERENCES}. Indicative screening, not a diagnosis.</footer>
        </ViewerPanel>
    );
}

function Reading({
    label,
    value,
    note,
    tone,
}: {
    label: string;
    value: string;
    note: string;
    tone: Tone;
}): React.JSX.Element {
    return (
        <div className={styles.reading} data-tone={tone}>
            <dt>{label}</dt>
            <dd className={styles.readingValue}>{value}</dd>
            <dd className={styles.readingNote}>{note}</dd>
        </div>
    );
}

//------------------------------------------------------------------------------
/**
 * Alert raised when a bend is held too long, with what made it harmful.
 */
export function AlertBanner({
    isVisible,
    alertsToday,
    alert,
    factors,
}: {
    isVisible: boolean;
    alertsToday: number;
    alert: AngleExposureAlert | null;
    factors: ReadonlyArray<AggravatingFactor>;
}): React.JSX.Element {
    // Where the zone of the alert starts, forward, e.g. 60° for the zone that isn't acceptable.
    const zoneStartDeg = BACK_BENDING_RULES.zones.find(zone => zone.level === alert?.level && zone.min >= 0)?.min;

    return (
        <div role="alert" aria-hidden={!isVisible} className={styles.banner} data-visible={isVisible}>
            <ViewerPanel variant="outline" className={styles.bannerPanel}>
                <WarningIcon />
                <div className={styles.bannerText}>
                    <strong className={styles.bannerTitle}>Harmful back bending</strong>
                    <span className={styles.bannerDetail}>
                        {alert && zoneStartDeg !== undefined
                            ? `Bent over ${zoneStartDeg}° for more than ${formatLimit(alert.holdLimitS)}, `
                            : ""}
                        {alertsToday} {alertsToday === 1 ? "time" : "times"} today
                    </span>
                    {factors.length > 0 && (
                        <span className={styles.factors}>
                            {factors.map(factor => (
                                <span key={factor.id} className={styles.factor}>
                                    {factor.label} <span className={styles.factorValue}>{factor.value}</span>
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            </ViewerPanel>
        </div>
    );
}

function formatLimit(seconds: number): string {
    return Number.isInteger(seconds) ? `${seconds} s` : formatSeconds(seconds);
}

function WarningIcon(): React.JSX.Element {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden className={styles.warningIcon}>
            <path d="M12 3 L22 20 H2 Z" fill="currentColor" strokeLinejoin="round" />
            <path d="M12 9.5 V14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1.1" fill="white" />
        </svg>
    );
}

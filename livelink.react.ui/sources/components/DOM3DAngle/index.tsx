//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";
import { DOM3DAnchor, DOM3DDiv } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DEG_TO_RAD, clamp, rotateVec3 } from "../RotationGizmo/math";
import { CameraFacingLayer } from "./CameraFacingLayer";
import { DOM3D_ANGLE_DEFAULTS as DEFAULTS } from "./defaults";
import { CENTER, VIEWBOX_SIZE, arcPath, pointAtAngle, wedgePath } from "./geometry";
import { NeedleDrawing, VertexDot } from "./Needle";
import {
    useAngleExposure,
    type AngleExposure,
    type AngleExposureAlert,
    type AngleExposureStatus,
    type AngleHoldLimits,
    type UseAngleExposureOptions,
} from "./useAngleExposure";
import { useViewportCamera, type ViewportCamera } from "./useViewportCamera";
import { add, cross, dot, length, normalize, reject, scale, subtract } from "./vector";
import {
    ANGLE_ZONE_LEVEL_LABELS,
    findZoneIndex,
    zoneBoundaries,
    type AngleZone,
    type AngleZoneLevel,
    type ShownLevel,
} from "./zones";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
// Only the component and types: a module exporting anything else can't be updated in place by React Fast Refresh.
// The hook and the zones are exported from their own modules.
export type {
    AngleExposure,
    AngleExposureAlert,
    AngleExposureStatus,
    AngleHoldLimits,
    AngleZone,
    AngleZoneLevel,
    UseAngleExposureOptions,
};

//------------------------------------------------------------------------------
export type DOM3DAngleProps = {
    /**
     * World position of the vertex of the angle, e.g. the center of a joint.
     */
    worldPosition: Vec3;

    /**
     * Axis of the angle, e.g. the axis of a joint: the gauge lies in the plane perpendicular to it, and positive
     * angles turn `referenceDirection` around it, right-handed.
     */
    planeNormal: Vec3;

    /**
     * Direction of 0°. Defaults to the world up, [0, 1, 0], as an inclinometer: angles are measured from the
     * vertical. Only its part perpendicular to `planeNormal` is used.
     */
    referenceDirection?: Vec3;

    /**
     * Measured angle, in degrees.
     */
    angleDeg: number;

    /**
     * Zones of acceptability, sorted and contiguous, shown on the scale: the same ones as given to
     * `useAngleExposure`. Without them, the gauge only measures the angle, in grey.
     */
    zones?: ReadonlyArray<AngleZone>;

    /**
     * Seconds the angle can stay continuously at each level, or worse, before the alert, e.g. `{ notAcceptable: 4 }`.
     * In a zone with a limit, the needle is the progress bar of the time held: it fills up to the limit, then
     * pulses. Timed by the component itself, from `zones`; ignored when `exposure` is given, which is timed against
     * the limits given to `useAngleExposure`. Without either, nothing is timed.
     */
    holdLimits?: AngleHoldLimits;

    /**
     * Exposure computed by `useAngleExposure` from the same angle and zones, for the status and the time the angle
     * has been held, e.g. to share it with the rest of the interface. Takes the place of `holdLimits`.
     */
    exposure?: AngleExposure;

    /**
     * Size of the gauge, in world units: the distance from the vertex to its scale. Defaults to 0.22.
     */
    size?: number;

    /**
     * Length of the needle, in world units, e.g. the length of the link a joint turns, so that it runs along it.
     * Defaults to 1.25 times `size`.
     */
    needleLength?: number;

    /**
     * Angles covered by the scale, in degrees. Defaults to [-90, 90].
     */
    scaleRange?: readonly [min: number, max: number];

    /**
     * Angle over which each end of the scale fades out, in degrees, e.g. 30 for a scale that dissolves rather than
     * stops. Defaults to 70, 0 for sharp ends.
     */
    scaleFadeDeg?: number;

    /**
     * Accuracy of the measurement, in degrees, shown around the needle, in the plane of the gauge. Defaults to 0,
     * hidden.
     */
    uncertaintyDeg?: number;

    /**
     * Whether to show the needle, the straight line from the vertex to `needleLength` along the angle, facing the
     * camera, over the gauge, with the accuracy of the measurement around it. It is also the progress bar of the
     * time held. Defaults to true. Without it, only the vertex is marked, e.g. to draw a shape of your own instead.
     */
    showNeedle?: boolean;

    /**
     * Content shown beside the vertex, e.g. a readout of the value: facing the camera, at a constant size on
     * screen, on the side of the screen the scale doesn't extend to. Its wrapper has `data-side`, the side of the
     * vertex it is on, "left" or "right", for it to lay itself out away from the vertex, and it inherits the
     * `--dom3d-angle-color-*` variables of the zones. It lets pointer events through, unless it sets
     * `pointer-events: auto`.
     */
    children?: React.ReactNode;

    className?: string;
    style?: React.CSSProperties;
};

//------------------------------------------------------------------------------
/** The needle runs past the scale by default, by this ratio of `size`. */
const DEFAULT_NEEDLE_LENGTH_RATIO = 1.25;

/** Size of the gauge before it is laid in the world, high enough for the strokes to stay sharp up close. */
const GAUGE_PIXEL_SIZE = 480;
/** The plumb line, the 0° reference, goes past the scale by this ratio of `size`. */
const PLUMB_LINE_RATIO = 1.32;
const SCALE_LABEL_RATIO = 1.16;
const TICK_STEP_DEG = 10;
const MAJOR_TICK_STEP_DEG = 30;
/** Ticks are drawn as lines this long, in viewBox units, cut to their length, and given their width, in CSS. */
const TICK_LINE_LENGTH = 20;
/** Gap between two zones on the scale, in degrees. */
const ZONE_GAP_DEG = 0.8;

/**
 * Sine of the angle between the line of sight and the plane of the gauge below which the gauge is hidden, about
 * 15°, and above which it is fully shown, about 30°: seen edge-on, it would only be a line. The needle stays.
 */
const EDGE_ON_HIDDEN = 0.25;
const EDGE_ON_SHOWN = 0.5;

/** World units per pixel and per world unit of distance to the camera, at which `DOM3DAnchor` scales its content. */
const DOM3D_ANCHOR_DISTANCE_SCALE = 0.001;
/** The content beside the vertex is at least this far from it, in world units, to clear what the angle is on. */
const CHILDREN_MIN_GAP = 0.2;
const CHILDREN_EXTRA_GAP_PX = 12;
/** Room around the camera-facing drawings, for the dots and the outline of the needle. */
const CAMERA_FACING_MARGIN_PX = 8;

/**
 * Shows an angle measured in the world, the way a goniometer or an inclinometer does, e.g. the angle of a robot
 * joint, or the inclination of the trunk of a worker tracked in real time. Optionally, it assesses the angle
 * against zones of acceptability, e.g. the working range of the joint, and alerts when it is held too long in one
 * that isn't acceptable.
 *
 * The gauge lies in the plane the angle is measured in, at its vertex:
 * - a dashed plumb line, the 0° reference;
 * - a scale graduated every 10°, colored by zone of acceptability, green, amber and red, or grey without zones;
 * - the angle, filled from 0°, in the color of its zone;
 * - optionally, the accuracy of the measurement around the needle.
 *
 * Facing the camera, so that it reads from any side, and over the gauge, the needle runs from the vertex along the
 * angle, in the color of the current zone. It is also the progress bar of the time held: in a zone with a hold
 * limit, it fills from the vertex outward up to the limit, then pulses. Seen edge-on, the gauge would only be a
 * line and fades out, while the needle keeps reading.
 *
 * The angle is timed against `holdLimits`, or, to share the exposure with the rest of the interface, e.g. to log
 * the alerts, by `useAngleExposure`, whose result is given as `exposure`. Content given as `children`, e.g. a
 * readout, is shown beside the vertex.
 *
 * Must be rendered inside `DOM3DOverlay`.
 *
 * @category Components
 *
 * @example
 * ```tsx
 * const JOINT_ZONES: Array<AngleZone> = [
 *     { min: Number.NEGATIVE_INFINITY, max: -90, level: "notAcceptable" },
 *     { min: -90, max: -60, level: "conditional" },
 *     { min: -60, max: 60, level: "acceptable" },
 *     { min: 60, max: 90, level: "conditional" },
 *     { min: 90, max: Number.POSITIVE_INFINITY, level: "notAcceptable" },
 * ];
 *
 * <DOM3DOverlay>
 *     <DOM3DAngle
 *         worldPosition={jointPosition}
 *         planeNormal={jointAxis}
 *         referenceDirection={restDirection}
 *         angleDeg={jointAngleDeg}
 *         zones={JOINT_ZONES}
 *         holdLimits={{ conditional: 10, notAcceptable: 2 }}
 *         needleLength={linkLength}
 *     />
 * </DOM3DOverlay>
 * ```
 */
export function DOM3DAngle(props: DOM3DAngleProps): React.JSX.Element {
    const { zones, holdLimits, exposure } = props;
    if (!exposure && holdLimits && zones?.length) {
        return <TimedDOM3DAngle {...props} zones={zones} holdLimits={holdLimits} />;
    }
    return <AngleGauge {...props} />;
}

//------------------------------------------------------------------------------
/** The gauge, with the angle timed by the component itself against `holdLimits`. */
function TimedDOM3DAngle(
    props: DOM3DAngleProps & { zones: ReadonlyArray<AngleZone>; holdLimits: AngleHoldLimits },
): React.JSX.Element {
    const exposure = useAngleExposure({ angleDeg: props.angleDeg, zones: props.zones, holdLimits: props.holdLimits });
    return <AngleGauge {...props} exposure={exposure} />;
}

//------------------------------------------------------------------------------
/** The gauge, the needle, and `children`, with the angle timed by `exposure`, if any. */
function AngleGauge({
    worldPosition,
    planeNormal,
    referenceDirection = DEFAULTS.referenceDirection,
    angleDeg,
    zones,
    exposure,
    size = DEFAULTS.size,
    needleLength = size * DEFAULT_NEEDLE_LENGTH_RATIO,
    scaleRange = DEFAULTS.scaleRange,
    scaleFadeDeg = DEFAULTS.scaleFadeDeg,
    uncertaintyDeg = DEFAULTS.uncertaintyDeg,
    showNeedle = DEFAULTS.showNeedle,
    children,
    className,
    style,
}: DOM3DAngleProps): React.JSX.Element {
    const viewportCamera = useViewportCamera();

    const halfSize = Math.max(size * PLUMB_LINE_RATIO, needleLength) * 1.05;
    const plane = computePlane({ worldPosition, planeNormal, referenceDirection, halfSize });
    const view = viewportCamera ? computeView({ plane, worldPosition, viewportCamera, size, scaleRange }) : null;
    const edgeOnAmount = view?.edgeOnAmount ?? 0;
    const gaugeOpacity = 1 - edgeOnAmount;

    const scaleZones = zones?.length ? zones : null;
    const level: ShownLevel = scaleZones
        ? (exposure?.level ?? scaleZones[findZoneIndex(angleDeg, scaleZones)]!.level)
        : "neutral";
    const isTimed = level === "conditional" || level === "notAcceptable";
    const status: AngleExposureStatus = scaleZones ? (exposure?.status ?? (isTimed ? "warning" : "ok")) : "ok";

    const needleTip = plane.pointAt(angleDeg, needleLength);
    const holdProgress = exposure && isTimed && exposure.holdLimitS ? exposure.holdS / exposure.holdLimitS : null;

    const rootClassName = [
        styles.root,
        styles[level],
        status === "alert" && styles.alerting,
        "livelink-react-ui-component",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    // Lengths in the viewBox.
    const toViewBox = VIEWBOX_SIZE / 2 / halfSize;
    const scaleRadius = size * toViewBox;
    const needle = needleLength * toViewBox;
    const shownAngleDeg = clamp(angleDeg, -180, 180);
    const plumbLineTop = pointAtAngle(CENTER, scaleRadius * PLUMB_LINE_RATIO, 0);

    const [scaleMin, scaleMax] = scaleRange;
    const zoneArcs = (scaleZones ?? [{ min: scaleMin, max: scaleMax, level: "neutral" as const }])
        .map(zone => ({
            level: zone.level,
            from: Math.max(zone.min, scaleMin) + (zone.min > scaleMin ? ZONE_GAP_DEG / 2 : 0),
            to: Math.min(zone.max, scaleMax) - (zone.max < scaleMax ? ZONE_GAP_DEG / 2 : 0),
        }))
        .filter(arc => arc.to > arc.from);
    const ticks: Array<number> = [];
    for (
        let tickDeg = Math.ceil(scaleMin / TICK_STEP_DEG) * TICK_STEP_DEG;
        tickDeg <= scaleMax;
        tickDeg += TICK_STEP_DEG
    ) {
        ticks.push(tickDeg);
    }
    const fade = createScaleFade(scaleRange, scaleFadeDeg);
    const scaleLabels = [...new Set([0, ...(scaleZones ? zoneBoundaries(scaleZones, scaleRange) : [])])]
        .map(labelDeg => ({
            angleDeg: labelDeg,
            // The 0° label belongs to the plumb line, past the scale: it doesn't fade with it.
            opacity: gaugeOpacity * (labelDeg === 0 ? 1 : fade.opacityAt(labelDeg)),
        }))
        .filter(scaleLabel => scaleLabel.opacity > 0);

    return (
        <>
            <DOM3DDiv
                worldQuad={plane.quad}
                worldUnitToPixelScale={GAUGE_PIXEL_SIZE / plane.size}
                className={rootClassName}
                style={{ ...style, pointerEvents: "none" }}
                data-level={level}
                data-status={status}
            >
                <div
                    className={styles.gauge}
                    style={{ opacity: gaugeOpacity }}
                    role="img"
                    aria-label={
                        `Angle: ${Math.round(angleDeg)}°` +
                        (level !== "neutral" ? `, ${ANGLE_ZONE_LEVEL_LABELS[level]}` : "")
                    }
                >
                    {/* The scale, apart, so that its ends can fade out. */}
                    <svg
                        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
                        className={styles.gaugeLayer}
                        style={fade.mask ? { maskImage: fade.mask, WebkitMaskImage: fade.mask } : undefined}
                    >
                        {zoneArcs.map(arc => (
                            <path
                                key={`${arc.from}`}
                                className={styles.zoneBand}
                                data-level={arc.level}
                                d={arcPath(CENTER, scaleRadius, arc.from, arc.to)}
                            />
                        ))}
                        {ticks.map(tickDeg => (
                            // Drawn at 0°, outward from the scale, and turned to its angle, so that CSS can cut it to
                            // its length and move it to the inner edge of the zones.
                            <g key={tickDeg} transform={`rotate(${tickDeg} ${CENTER.x} ${CENTER.y})`}>
                                <line
                                    className={tickDeg % MAJOR_TICK_STEP_DEG === 0 ? styles.majorTick : styles.tick}
                                    data-level={
                                        scaleZones ? scaleZones[findZoneIndex(tickDeg, scaleZones)]!.level : "neutral"
                                    }
                                    x1={CENTER.x}
                                    y1={CENTER.y - scaleRadius}
                                    x2={CENTER.x}
                                    y2={CENTER.y - scaleRadius - TICK_LINE_LENGTH}
                                />
                            </g>
                        ))}
                    </svg>
                    <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className={styles.gaugeLayer}>
                        <line
                            className={styles.plumbLine}
                            x1={CENTER.x}
                            y1={CENTER.y}
                            x2={plumbLineTop.x}
                            y2={plumbLineTop.y}
                        />
                        <path className={styles.sector} d={wedgePath(CENTER, scaleRadius * 0.92, 0, shownAngleDeg)} />
                        {showNeedle && uncertaintyDeg > 0 && (
                            <path
                                className={styles.uncertaintyBand}
                                d={wedgePath(
                                    CENTER,
                                    needle,
                                    shownAngleDeg - uncertaintyDeg,
                                    shownAngleDeg + uncertaintyDeg,
                                )}
                            />
                        )}
                    </svg>
                </div>
            </DOM3DDiv>
            {scaleLabels.map(scaleLabel => (
                // Facing the camera, so that the labels never read mirrored when the gauge is seen from behind.
                <DOM3DAnchor
                    key={scaleLabel.angleDeg}
                    worldPosition={plane.pointAt(
                        scaleLabel.angleDeg,
                        size * (scaleLabel.angleDeg === 0 ? PLUMB_LINE_RATIO + 0.1 : SCALE_LABEL_RATIO),
                    )}
                    className={rootClassName}
                    style={{ ...style, pointerEvents: "none", opacity: scaleLabel.opacity }}
                >
                    <span className={styles.scaleLabel}>{scaleLabel.angleDeg}°</span>
                </DOM3DAnchor>
            ))}
            {viewportCamera && (
                <CameraFacingLayer
                    anchor={worldPosition}
                    viewportCamera={viewportCamera}
                    extent={showNeedle ? [worldPosition, needleTip] : [worldPosition]}
                    marginPx={CAMERA_FACING_MARGIN_PX}
                    className={rootClassName}
                    style={style}
                >
                    {project =>
                        showNeedle ? (
                            <NeedleDrawing
                                from={worldPosition}
                                to={needleTip}
                                project={project}
                                level={level}
                                holdProgress={holdProgress}
                            />
                        ) : (
                            <VertexDot position={worldPosition} project={project} level={level} />
                        )
                    }
                </CameraFacingLayer>
            )}
            {children && view && (
                <ChildrenBeside
                    worldPosition={worldPosition}
                    side={view.childrenSide}
                    gapPx={view.childrenGapPx}
                    pixelRatio={view.pixelRatio}
                    className={rootClassName}
                    style={style}
                >
                    {children}
                </ChildrenBeside>
            )}
        </>
    );
}

//------------------------------------------------------------------------------
/**
 * Fade-out of the ends of the scale over `fadeDeg`: a conic mask, from 0° straight up and clockwise like the angles
 * of the gauge, and the opacity it gives at an angle, for what is drawn outside of it, e.g. the labels.
 */
function createScaleFade(
    [min, max]: readonly [min: number, max: number],
    fadeDeg: number,
): { mask: string | null; opacityAt: (angleDeg: number) => number } {
    const spanDeg = max - min;
    const shownFadeDeg = clamp(fadeDeg, 0, spanDeg / 2);
    if (shownFadeDeg <= 0) {
        return { mask: null, opacityAt: () => 1 };
    }

    return {
        mask:
            `conic-gradient(from ${min}deg at 50% 50%, transparent 0deg, #000 ${shownFadeDeg}deg, ` +
            `#000 ${spanDeg - shownFadeDeg}deg, transparent ${spanDeg}deg)`,
        opacityAt: angleDeg => clamp(Math.min(angleDeg - min, max - angleDeg) / shownFadeDeg, 0, 1),
    };
}

//------------------------------------------------------------------------------
/**
 * `children`, beside the vertex, facing the camera, at a constant size on screen: `DOM3DAnchor` scales its content
 * with the distance, which `pixelRatio` cancels.
 */
function ChildrenBeside({
    worldPosition,
    side,
    gapPx,
    pixelRatio,
    className,
    style,
    children,
}: {
    worldPosition: Vec3;
    /** Side of the vertex the content is on, on screen. */
    side: "left" | "right";
    /** Distance between the vertex and the content, in pixels. */
    gapPx: number;
    /** Scale bringing the content of `DOM3DAnchor` to 1 CSS pixel per screen pixel. */
    pixelRatio: number;
    className: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}): React.JSX.Element {
    const anchoredEdge = side === "right" ? "left" : "right";

    return (
        <DOM3DAnchor
            worldPosition={worldPosition}
            offset={`${anchoredEdge}-center`}
            className={className}
            style={{ ...style }}
        >
            <div
                data-side={side}
                style={{
                    translate: `${(side === "right" ? gapPx : -gapPx) * pixelRatio}px 0`,
                    scale: String(pixelRatio),
                    transformOrigin: `${anchoredEdge} center`,
                }}
            >
                {children}
            </div>
        </DOM3DAnchor>
    );
}

//------------------------------------------------------------------------------
type Plane = {
    normal: Vec3;
    /** 0° direction. */
    up: Vec3;
    /** 90° direction. */
    right: Vec3;
    quad: [Vec3, Vec3, Vec3, Vec3];
    size: number;
    pointAt: (angleDeg: number, distance: number) => Vec3;
};

/**
 * The world quad the gauge is laid on, centered on its vertex, `2 * halfSize` wide. 0°, the up direction of the
 * viewBox, is along `referenceDirection`, and the right of the viewBox is along `planeNormal` × `referenceDirection`:
 * the direction a positive rotation around `planeNormal` turns `referenceDirection` to, so that the angles drawn
 * clockwise in the viewBox by `geometry.ts` are rotations around `planeNormal` in the world.
 */
function computePlane({
    worldPosition,
    planeNormal,
    referenceDirection,
    halfSize,
}: {
    worldPosition: Vec3;
    planeNormal: Vec3;
    referenceDirection: Vec3;
    halfSize: number;
}): Plane {
    const normal = normalize(planeNormal);
    const up = normalize(reject(referenceDirection, normal));
    const right = cross(normal, up);

    const at = (upAmount: number, rightAmount: number): Vec3 =>
        add(worldPosition, add(scale(up, upAmount), scale(right, rightAmount)));

    return {
        normal,
        up,
        right,
        quad: [at(halfSize, -halfSize), at(halfSize, halfSize), at(-halfSize, halfSize), at(-halfSize, -halfSize)],
        size: 2 * halfSize,
        pointAt: (angleDeg, distance) =>
            at(distance * Math.cos(angleDeg * DEG_TO_RAD), distance * Math.sin(angleDeg * DEG_TO_RAD)),
    };
}

/**
 * How the gauge is seen from the camera: how edge-on, from 0 to 1, and where `children` go. They go on the side of
 * the screen the scale doesn't extend to, away from its 90° direction, far enough from the vertex to clear the
 * negative angles of the scale.
 */
function computeView({
    plane,
    worldPosition,
    viewportCamera,
    size,
    scaleRange,
}: {
    plane: Plane;
    worldPosition: Vec3;
    viewportCamera: ViewportCamera;
    size: number;
    scaleRange: readonly [min: number, max: number];
}): { edgeOnAmount: number; childrenSide: "left" | "right"; childrenGapPx: number; pixelRatio: number } | null {
    const lineOfSight = subtract(worldPosition, viewportCamera.position);
    const distance = length(lineOfSight);
    if (distance === 0) {
        return null;
    }

    // Sine of the angle between the line of sight and the plane.
    const facing = Math.abs(dot(plane.normal, lineOfSight)) / distance;
    const cameraRight = rotateVec3(viewportCamera.orientation, [1, 0, 0]);
    const pixelsPerUnit = viewportCamera.focalLengthPx / distance;
    // How far the scale and its labels extend on the side of the negative angles.
    const negativeExtent = size * SCALE_LABEL_RATIO * Math.sin(clamp(-scaleRange[0], 0, 90) * DEG_TO_RAD);

    return {
        edgeOnAmount: 1 - smoothstep(EDGE_ON_HIDDEN, EDGE_ON_SHOWN, facing),
        childrenSide: dot(plane.right, cameraRight) > 0.2 ? "left" : "right",
        childrenGapPx: Math.max(size * 0.6, negativeExtent, CHILDREN_MIN_GAP) * pixelsPerUnit + CHILDREN_EXTRA_GAP_PX,
        pixelRatio: 1 / (DOM3D_ANCHOR_DISTANCE_SCALE * viewportCamera.focalLengthPx),
    };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

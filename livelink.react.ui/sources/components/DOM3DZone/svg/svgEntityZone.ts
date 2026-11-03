//------------------------------------------------------------------------------
// A prototype of `EntityZone` in SVG rather than three.js: the same pad, sweep and curtain, projected on the
// viewport each frame and drawn as paths, in screen pixels.
//
// The stream hands it no depth either. The occluder's outline on screen, blurred, masks what the box can stand in
// front of — exactly that, for a box standing on the pad and inside the curtain, with the camera above the pad:
// - a point of the pad inside the outline is behind the box, or under it: the line of sight cannot cross the pad
//   first and meet the box past it, below the pad. The whole pad is masked;
// - the curtain's near side, which faces the camera, is where the line of sight enters the curtain, the box past it:
//   it is never masked. Its far side, seen through the curtain, is.
// It is three.js' `BackSide` and `FrontSide`, drawn before and after the pad, split here at the curtain's outline.
//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { rotateVec3 } from "../../RotationGizmo/math";
import { add, subtract } from "../../DOM3DAngle/vector";
import type { EntityZoneColors, ResolvedEntityZoneOptions } from "../entityZoneOptions";
import { boxCorners, type ScreenPoint, type SvgCamera, toPathData } from "./svgCamera";

//------------------------------------------------------------------------------
const SVG_NS = "http://www.w3.org/2000/svg";
const TAU = 2 * Math.PI;

/** Between two points of an arc, at most: 96 to the turn, as the three.js curtain's segments. */
const ARC_STEP_RAD = TAU / 96;

/** The pad, a little above the entity's feet, as the three.js pad is. */
const PAD_LIFT_M = 0.002;

/** As in `entityZone.ts`: the pad's inner ring, as a share of its radius, and how it goes round an occluder. */
const FOOT_SHARE = 0.42;
const FOOT_MARGIN_SHARE = 0.05;
const MAX_FOOT_SHARE = 0.75;

const TICK_COUNT = 72;
/** Every sixth tick, every 30°, is long. */
const LONG_TICK_EVERY = 6;
const DASH_CELLS = 24;

/** The sweep's trail, in slices as wide as this, each fainter than the one before: its fade, in steps. */
const SWEEP_SLICE_RAD = 0.1;
const SWEEP_SLICES = 20;
/** How fast the trail fades, per radian behind the sweep's edge, as the pad's shader fades it. */
const SWEEP_FADE_PER_RAD = 2.5;

/** The curtain's scan lines: 14 up its height, each a bright and a dim band, drifting up a band a second. */
const SCAN_BANDS = 28;
/** Bands, at most, as they drift: one more than fits, cut at the floor and the top. */
const MAX_SCAN_BANDS = SCAN_BANDS + 1;
/** The brighter band at the curtain's foot, as a share of its height. */
const CURTAIN_FOOT_SHARE = 0.05;

/** Under this much turn between two frames, the entity is taken as going straight: the trail stays as it was. */
const MIN_TURN_RAD = 1e-4;

/** A softness as an angle, into a blur's standard deviation in pixels: the fade's width spans about 4 of them. */
const SOFTNESS_TO_SIGMA = 1 / 4;

let nextZoneId = 0;

//------------------------------------------------------------------------------
/** One half of the curtain: its bands, the brighter one at its foot, and the group they are drawn in. */
type CurtainHalf = { group: SVGGElement; bands: SVGPathElement[]; foot: SVGPathElement };

//------------------------------------------------------------------------------
export class SvgEntityZone {
    //--------------------------------------------------------------------------
    readonly root: SVGGElement;
    readonly #entity: Entity;
    readonly #options: ResolvedEntityZoneOptions;
    readonly #foot: number;
    readonly #maskUrl: string;
    readonly #outline: SVGPolygonElement;
    readonly #blur: SVGFEGaussianBlurElement;
    readonly #farCurtain: CurtainHalf;
    readonly #nearCurtain: CurtainHalf;
    readonly #pad: SVGGElement;
    readonly #glass: SVGPathElement;
    readonly #rim: SVGPathElement;
    readonly #footRing: SVGPathElement;
    readonly #ticks: SVGPathElement;
    readonly #dashes: SVGPathElement;
    readonly #trail: SVGPathElement[];
    readonly #edge: SVGPathElement;
    readonly #isTurnInferred: boolean;
    #turnDirection: 1 | -1;
    #lastHeading: number | null = null;
    #clockS = 0;
    #lastFrameMs = 0;

    //--------------------------------------------------------------------------
    constructor(options: ResolvedEntityZoneOptions) {
        this.#entity = options.entity;
        this.#options = options;
        this.#foot = footShare(options);
        this.#isTurnInferred = options.turnDirection === undefined;
        this.#turnDirection = options.turnDirection ?? 1;

        //----------------------------------------------------------------------
        // The mask: white where the zone shows, the occluder's outline black, blurred for its edge to fade.
        const id = `entity-zone-svg-${nextZoneId++}`;
        this.#maskUrl = `url(#${id}-mask)`;
        this.root = createSvg("g", {});
        const defs = createSvg("defs", {}, this.root);
        const filter = createSvg(
            "filter",
            { id: `${id}-blur`, filterUnits: "userSpaceOnUse", x: 0, y: 0, width: "100%", height: "100%" },
            defs,
        );
        this.#blur = createSvg("feGaussianBlur", { stdDeviation: 0 }, filter);
        const mask = createSvg(
            "mask",
            { id: `${id}-mask`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: "100%", height: "100%" },
            defs,
        );
        createSvg("rect", { x: 0, y: 0, width: "100%", height: "100%", fill: "white" }, mask);
        this.#outline = createSvg("polygon", { fill: "black", filter: `url(#${id}-blur)` }, mask);

        //----------------------------------------------------------------------
        // Drawn in this order: the curtain's far half, the pad, the curtain's near half.
        this.#farCurtain = createCurtainHalf(this.root);
        this.#pad = createSvg("g", {}, this.root);
        this.#nearCurtain = createCurtainHalf(this.root);
        if (options.occluder) {
            this.#farCurtain.group.setAttribute("mask", this.#maskUrl);
        }

        this.#glass = createSvg("path", { "fill-opacity": 0.2 }, this.#pad);
        this.#trail = Array.from({ length: SWEEP_SLICES }, (_, slice) =>
            createSvg(
                "path",
                { "fill-opacity": 0.35 * Math.exp(-SWEEP_FADE_PER_RAD * (slice + 0.5) * SWEEP_SLICE_RAD) },
                this.#pad,
            ),
        );
        this.#edge = createStroke(this.#pad, 2, 0.8);
        this.#footRing = createStroke(this.#pad, 1, 0.35);
        this.#dashes = createStroke(this.#pad, 1.5, 0.5);
        this.#ticks = createStroke(this.#pad, 1, 0.45);
        this.#rim = createStroke(this.#pad, 1.5, 0.85);

        this.setColors(options.colors);
    }

    //--------------------------------------------------------------------------
    /** Any CSS colour, a token's `var()` included: SVG reads them as they are, in whichever theme is current. */
    setColors({ glass, edge, sweep }: EntityZoneColors): void {
        this.#glass.style.fill = glass;
        for (const path of [this.#rim, this.#footRing, this.#ticks, this.#dashes]) {
            path.style.stroke = edge;
        }
        for (const { bands, foot } of [this.#farCurtain, this.#nearCurtain]) {
            for (const path of [...bands, foot]) {
                path.style.fill = edge;
            }
        }
        for (const path of this.#trail) {
            path.style.fill = sweep;
        }
        this.#edge.style.stroke = sweep;
    }

    dispose(): void {
        this.root.remove();
    }

    //--------------------------------------------------------------------------
    /** Draws the zone at the entity's feet, as it stands now, seen by `camera`. */
    update(camera: SvgCamera): void {
        //----------------------------------------------------------------------
        const nowMs = performance.now();
        const dt = this.#lastFrameMs > 0 ? Math.min((nowMs - this.#lastFrameMs) / 1000, 0.1) : 0;
        this.#lastFrameMs = nowMs;
        this.#clockS += dt;

        //----------------------------------------------------------------------
        const { position, orientation } = this.#entity.global_transform;
        const origin: Vec3 = [...position];
        const facing = rotateVec3(orientation, [0, 0, 1]);
        const heading = Math.atan2(facing[0], facing[2]);
        if (this.#isTurnInferred && this.#lastHeading !== null) {
            const turn = Math.atan2(Math.sin(heading - this.#lastHeading), Math.cos(heading - this.#lastHeading));
            if (Math.abs(turn) > MIN_TURN_RAD) {
                this.#turnDirection = turn > 0 ? 1 : -1;
            }
        }
        this.#lastHeading = heading;

        //----------------------------------------------------------------------
        const { occluder, occlusionSoftnessRad } = this.#options;
        if (occluder) {
            const corners = boxCorners(occluder.min, occluder.max).map(corner =>
                add(origin, rotateVec3(orientation, corner)),
            );
            // From inside the box, it hides everything behind it: all of the zone the mask covers.
            const isCameraInBox = isInBox(
                rotateVec3(
                    [-orientation[0], -orientation[1], -orientation[2], orientation[3]],
                    subtract(camera.position, origin),
                ),
                occluder,
            );
            const outline: ScreenPoint[] = isCameraInBox
                ? [
                      { x: 0, y: 0 },
                      { x: camera.widthPx, y: 0 },
                      { x: camera.widthPx, y: camera.heightPx },
                      { x: 0, y: camera.heightPx },
                  ]
                : camera.projectBoxOutline(corners);
            this.#outline.setAttribute("points", outline.map(({ x, y }) => `${x},${y}`).join(" "));
            this.#blur.setAttribute(
                "stdDeviation",
                String(occlusionSoftnessRad * camera.focalLengthPx * SOFTNESS_TO_SIGMA),
            );
            // From under the pad, the pad is in front of the box: unmasked.
            if (camera.position[1] > origin[1] + PAD_LIFT_M) {
                this.#pad.setAttribute("mask", this.#maskUrl);
            } else {
                this.#pad.removeAttribute("mask");
            }
        }

        this.#drawPad(camera, origin, heading);
        this.#drawCurtain(camera, origin);
    }

    //--------------------------------------------------------------------------
    #drawPad(camera: SvgCamera, origin: Vec3, heading: number): void {
        const { radiusM, show } = this.#options;
        const foot = this.#foot;
        const at = (share: number, angle: number): Vec3 => groundPoint(origin, share * radiusM, angle, PAD_LIFT_M);
        const ring = (share: number, from = 0, to = TAU): Vec3[] => arc(origin, share * radiusM, from, to, PAD_LIFT_M);

        this.#glass.setAttribute("d", toPathData([camera.projectPolygon(ring(1))], true));
        this.#rim.setAttribute("d", toPathData(camera.projectPolyline(ring(0.985))));
        this.#footRing.setAttribute("d", toPathData(camera.projectPolyline(ring(foot))));

        // Every 5°, from straight behind: long ones from 0.84 of the radius, short ones from 0.88, to 0.93.
        const ticks = show.ticks
            ? Array.from({ length: TICK_COUNT }, (_, tick) => {
                  const angle = (tick / TICK_COUNT) * TAU - Math.PI;
                  const from = tick % LONG_TICK_EVERY === 0 ? 0.84 : 0.88;
                  return camera.projectPolyline([at(from, angle), at(0.93, angle)]);
              }).flat()
            : [];
        this.#ticks.setAttribute("d", toPathData(ticks));

        // Two thirds of the way from the inner ring to the ticks, its dashes turning with the entity.
        const dashShare = foot + (0.84 - foot) * (2 / 3);
        const dashes = show.dashedRing
            ? Array.from({ length: DASH_CELLS }, (_, cell) => {
                  const from = heading + ((cell + 0.5) / DASH_CELLS) * TAU;
                  return camera.projectPolyline(ring(dashShare, from, from + (0.5 / DASH_CELLS) * TAU));
              }).flat()
            : [];
        this.#dashes.setAttribute("d", toPathData(dashes));

        // The sweep's edge along the entity's +Z, its trail fading behind it, the way the entity turns.
        const inner = foot + 0.03;
        const outer = 0.92;
        const behind = (rad: number): number => heading - this.#turnDirection * rad;
        this.#trail.forEach((path, slice) => {
            const from = behind(slice * SWEEP_SLICE_RAD);
            const to = behind((slice + 1) * SWEEP_SLICE_RAD);
            const polygon = show.sweep
                ? camera.projectPolygon([...ring(inner, from, to), ...ring(outer, to, from)])
                : [];
            path.setAttribute("d", toPathData([polygon], true));
        });
        const edge = show.sweep ? camera.projectPolyline([at(inner, heading), at(outer, heading)]) : [];
        this.#edge.setAttribute("d", toPathData(edge));
    }

    //--------------------------------------------------------------------------
    /**
     * The curtain, split at its outline: its near half the arc facing the camera, between the two lines along which
     * the camera sees the curtain's edge, its far half the rest. From within its radius, all of it is far.
     */
    #drawCurtain(camera: SvgCamera, origin: Vec3): void {
        const { radiusM, curtainHeightM, show } = this.#options;
        const isShown = show.curtain && curtainHeightM > 0;
        const toEyeX = camera.position[0] - origin[0];
        const toEyeZ = camera.position[2] - origin[2];
        const eyeDistanceM = Math.hypot(toEyeX, toEyeZ);
        const toEye = Math.atan2(toEyeX, toEyeZ);
        const nearHalfWidth = eyeDistanceM > radiusM ? Math.acos(radiusM / eyeDistanceM) : 0;

        const halves: [CurtainHalf, number, number][] = [
            [this.#nearCurtain, toEye - nearHalfWidth, toEye + nearHalfWidth],
            [this.#farCurtain, toEye + nearHalfWidth, toEye - nearHalfWidth + TAU],
        ];
        for (const [half, from, to] of halves) {
            const isDrawn = isShown && to > from;
            const band = (bottom: number, top: number): string =>
                isDrawn
                    ? toPathData(
                          [
                              camera.projectPolygon([
                                  ...arc(origin, radiusM, from, to, bottom * curtainHeightM),
                                  ...arc(origin, radiusM, to, from, top * curtainHeightM),
                              ]),
                          ],
                          true,
                      )
                    : "";

            // Brightest at the floor, gone at the top, as the curtain's shader fades it.
            const drift = this.#clockS % 1;
            half.bands.forEach((path, index) => {
                const bottom = Math.max((index - 1 + drift) / SCAN_BANDS, 0);
                const top = Math.min((index + drift) / SCAN_BANDS, 1);
                if (top <= bottom) {
                    path.setAttribute("d", "");
                    return;
                }
                const middle = (bottom + top) / 2;
                const isBright = Math.floor(middle * SCAN_BANDS - this.#clockS) % 2 !== 0;
                path.setAttribute("fill-opacity", String(0.18 * Math.pow(1 - middle, 1.8) * (isBright ? 1 : 0.7)));
                path.setAttribute("d", band(bottom, top));
            });
            half.foot.setAttribute("d", band(0, CURTAIN_FOOT_SHARE));
        }
    }
}

//------------------------------------------------------------------------------
/** As in `entityZone.ts`: the inner ring round the occluder's footprint, whichever way the entity turns. */
function footShare({ radiusM, occluder }: ResolvedEntityZoneOptions): number {
    if (!occluder) {
        return FOOT_SHARE;
    }
    const { min, max } = occluder;
    const footprintM = Math.hypot(
        Math.max(Math.abs(min[0]), Math.abs(max[0])),
        Math.max(Math.abs(min[2]), Math.abs(max[2])),
    );
    return Math.min(Math.max(footprintM / radiusM + FOOT_MARGIN_SHARE, FOOT_SHARE), MAX_FOOT_SHARE);
}

/** The point at `radiusM` from `origin`, `angle` from +Z towards +X, `heightM` above it. */
function groundPoint(origin: Vec3, radiusM: number, angle: number, heightM: number): Vec3 {
    return [origin[0] + radiusM * Math.sin(angle), origin[1] + heightM, origin[2] + radiusM * Math.cos(angle)];
}

/** The arc at `radiusM` round `origin`, from `from` to `to`, either way round, `heightM` above it. */
function arc(origin: Vec3, radiusM: number, from: number, to: number, heightM: number): Vec3[] {
    const steps = Math.max(1, Math.ceil(Math.abs(to - from) / ARC_STEP_RAD));
    return Array.from({ length: steps + 1 }, (_, step) =>
        groundPoint(origin, radiusM, from + ((to - from) * step) / steps, heightM),
    );
}

function isInBox(point: Vec3, { min, max }: { min: Vec3; max: Vec3 }): boolean {
    return point.every((value, axis) => value >= min[axis] && value <= max[axis]);
}

//------------------------------------------------------------------------------
function createSvg<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string | number>,
    parent?: SVGElement,
): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value));
    }
    parent?.append(element);
    return element;
}

/** A line of the pad, as wide on screen whatever the distance: SVG's strokes are in pixels. */
function createStroke(parent: SVGElement, widthPx: number, opacity: number): SVGPathElement {
    return createSvg(
        "path",
        { fill: "none", "stroke-width": widthPx, "stroke-opacity": opacity, "stroke-linecap": "round" },
        parent,
    );
}

function createCurtainHalf(parent: SVGElement): CurtainHalf {
    const group = createSvg("g", {}, parent);
    return {
        group,
        bands: Array.from({ length: MAX_SCAN_BANDS }, () => createSvg("path", {}, group)),
        foot: createSvg("path", { "fill-opacity": 0.1 }, group),
    };
}

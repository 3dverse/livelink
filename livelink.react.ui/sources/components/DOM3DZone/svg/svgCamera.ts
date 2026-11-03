//------------------------------------------------------------------------------
import type { Quat, Vec3, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { rotateVec3 } from "../../RotationGizmo/math";
import { subtract } from "../../DOM3DAngle/vector";

//------------------------------------------------------------------------------
/** A point on screen, in CSS pixels from the viewport's top left corner, y down: the SVG's own units. */
export type ScreenPoint = { x: number; y: number };

/** Nothing nearer the camera than this is drawn: what goes past it is cut along it, as by a near plane. */
const NEAR_M = 0.01;

/** A box's twelve edges, between its corners numbered as `boxCorners` numbers them: x, y and z the bits of the index. */
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [0, 1, 2, 3, 4, 5, 6, 7].flatMap(corner =>
    [1, 2, 4].filter(bit => (corner & bit) === 0).map(bit => [corner, corner | bit] as const),
);

//------------------------------------------------------------------------------
/**
 * The viewport's camera as it was when the frame about to be shown was rendered, projecting the world on the
 * viewport in CSS pixels, for SVG to draw over the stream. What goes behind the camera is cut at `NEAR_M` before it
 * is projected: lines and polygons stay whole up to it, and never wrap round to the other side of the screen.
 */
export class SvgCamera {
    //--------------------------------------------------------------------------
    readonly position: Vec3;
    readonly widthPx: number;
    readonly heightPx: number;
    /** Pixels on screen per meter, a meter from the camera: what turns an angle seen from the camera into pixels. */
    readonly focalLengthPx: number;
    /** The camera's orientation, inverted: from the world's axes into the camera's, -Z ahead. */
    readonly #viewFromWorld: Quat;
    /** Column-major, as livelink hands it. */
    readonly #clipFromView: ArrayLike<number>;

    //--------------------------------------------------------------------------
    /** The camera of the frame the viewport is drawing: null before it has one. */
    static fromViewport(viewport: Viewport): SvgCamera | null {
        const projection = viewport.camera_projection;
        if (!projection) {
            return null;
        }
        const { clientWidth, clientHeight } = viewport.dom_element;
        return new SvgCamera({
            position: [...projection.world_position] as Vec3,
            orientation: [...projection.world_orientation] as Quat,
            clipFromView: projection.clip_from_view_matrix,
            widthPx: clientWidth,
            heightPx: clientHeight,
        });
    }

    //--------------------------------------------------------------------------
    constructor({
        position,
        orientation: [x, y, z, w],
        clipFromView,
        widthPx,
        heightPx,
    }: {
        position: Vec3;
        orientation: Quat;
        clipFromView: ArrayLike<number>;
        widthPx: number;
        heightPx: number;
    }) {
        this.position = position;
        this.#viewFromWorld = [-x, -y, -z, w];
        this.#clipFromView = clipFromView;
        this.widthPx = widthPx;
        this.heightPx = heightPx;
        // As DOM3DOverlay, and DOM3DAngle's `useViewportCamera`, work it out.
        this.focalLengthPx = (clipFromView[5] * heightPx) / 2;
    }

    //--------------------------------------------------------------------------
    /** An open line through `world`, as runs on screen: one, unless the camera cuts it into several. */
    projectPolyline(world: ReadonlyArray<Vec3>): ScreenPoint[][] {
        const runs: ScreenPoint[][] = [];
        let run: ScreenPoint[] = [];
        let previous: Vec3 | null = null;
        for (const point of world) {
            const view = this.#toView(point);
            if (previous && isInFront(previous) !== isInFront(view)) {
                run.push(this.#toScreen(cutAtNear(previous, view)));
                if (!isInFront(view)) {
                    runs.push(run);
                    run = [];
                }
            }
            if (isInFront(view)) {
                run.push(this.#toScreen(view));
            }
            previous = view;
        }
        runs.push(run);
        return runs.filter(points => points.length > 1);
    }

    /** A polygon through `world`, on screen: as much of it as lies in front of the camera. */
    projectPolygon(world: ReadonlyArray<Vec3>): ScreenPoint[] {
        const view = world.map(point => this.#toView(point));
        const kept: Vec3[] = [];
        view.forEach((current, index) => {
            const previous = view[(index + view.length - 1) % view.length];
            if (isInFront(previous) !== isInFront(current)) {
                kept.push(cutAtNear(previous, current));
            }
            if (isInFront(current)) {
                kept.push(current);
            }
        });
        return kept.map(point => this.#toScreen(point));
    }

    /**
     * The outline on screen of the box with `corners`, as `boxCorners` lists them: the convex hull of its corners in
     * front of the camera, and of where its edges cross the near plane.
     */
    projectBoxOutline(corners: ReadonlyArray<Vec3>): ScreenPoint[] {
        const view = corners.map(corner => this.#toView(corner));
        const points = view.filter(isInFront).map(point => this.#toScreen(point));
        for (const [a, b] of BOX_EDGES) {
            if (isInFront(view[a]) !== isInFront(view[b])) {
                points.push(this.#toScreen(cutAtNear(view[a], view[b])));
            }
        }
        return convexHull(points);
    }

    //--------------------------------------------------------------------------
    #toView(world: Vec3): Vec3 {
        return rotateVec3(this.#viewFromWorld, subtract(world, this.position));
    }

    /** A point in front of the camera, in its frame, on screen. */
    #toScreen([x, y, z]: Vec3): ScreenPoint {
        const m = this.#clipFromView;
        const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
        const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
        const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
        return {
            x: ((clipX / clipW + 1) / 2) * this.widthPx,
            y: ((1 - clipY / clipW) / 2) * this.heightPx,
        };
    }
}

//------------------------------------------------------------------------------
/** The eight corners of the box from `min` to `max`, the i-th at max along x, y and z as its bits 1, 2 and 4 are set. */
export function boxCorners(min: Vec3, max: Vec3): Vec3[] {
    return [0, 1, 2, 3, 4, 5, 6, 7].map(corner => [
        corner & 1 ? max[0] : min[0],
        corner & 2 ? max[1] : min[1],
        corner & 4 ? max[2] : min[2],
    ]);
}

/** SVG path data through `runs`: each run its own subpath, closed with `isClosed`. */
export function toPathData(runs: ReadonlyArray<ReadonlyArray<ScreenPoint>>, isClosed = false): string {
    return runs
        .filter(points => points.length > 1)
        .map(
            points => `M${points.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}${isClosed ? "Z" : ""}`,
        )
        .join("");
}

//------------------------------------------------------------------------------
function isInFront(view: Vec3): boolean {
    return view[2] <= -NEAR_M;
}

/** Where the segment from `a` to `b`, on either side of the near plane, crosses it. */
function cutAtNear(a: Vec3, b: Vec3): Vec3 {
    const t = (-NEAR_M - a[2]) / (b[2] - a[2]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -NEAR_M];
}

/** Andrew's monotone chain: the hull's points in order round it. */
function convexHull(points: ScreenPoint[]): ScreenPoint[] {
    if (points.length < 3) {
        return points;
    }
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const turn = (o: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number =>
        (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (ordered: ScreenPoint[]): ScreenPoint[] => {
        const chain: ScreenPoint[] = [];
        for (const point of ordered) {
            while (chain.length >= 2 && turn(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) {
                chain.pop();
            }
            chain.push(point);
        }
        chain.pop();
        return chain;
    };
    return [...half(sorted), ...half(sorted.reverse())];
}

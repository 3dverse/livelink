//------------------------------------------------------------------------------
import {
    CameraProjection,
    RelativeRect,
    Viewport,
    type ComponentsManifest,
    type Entity,
    type Livelink,
    type Quat,
    type RenderingSurfaceBase,
    type SceneSettingsRecord,
    type Vec3,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { SnapshotSurface } from "./SnapshotSurface";

/**
 * @internal
 */
const INVALID_RENDER_GRAPH_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * @internal
 */
const DEFAULT_RENDER_GRAPH_UUID = "398ee642-030a-45e7-95df-7147f6c43392";

/**
 * @internal
 */
const DEFAULT_RENDER_GRAPH_SETTINGS = { grid: true, skybox: false, gradient: true };

/**
 * @internal
 */
const DEFAULT_PERSPECTIVE_LENS = { fovy: 60, nearPlane: 0.1, farPlane: 0 };

/**
 * @internal
 * How close (in meters) a viewport's camera must be to its target position, as reported by the
 * server on each frame, before that viewport's snapshot is considered ready to capture.
 */
const SETTLE_POSITION_EPSILON = 0.01;

/**
 * @internal
 * Upper bound on how many frames to wait for a page of points of view to settle, so that a
 * single unreachable point of view can't hang the whole capture.
 */
const SETTLE_MAX_FRAMES = 90;

/**
 * @internal
 * Consecutive settled frames required before trusting it — a brand-new viewport can briefly
 * report a stale-but-matching position, so one lucky match isn't proof enough.
 */
const SETTLE_CONSECUTIVE_FRAMES = 5;

/**
 * A camera transform to capture a snapshot of.
 *
 * @category Hooks
 */
export type PointOfViewTransform = {
    /**
     * World space position of the point of view.
     */
    position: Vec3;

    /**
     * World space orientation of the point of view.
     */
    orientation: Quat;
};

/**
 * @internal
 *
 * A pool of `cellCount` temporary cameras rendered as a grid of viewports on one
 * {@link SnapshotSurface}, capturing several points of view at once.
 *
 * Usage: `create()`, then `captureFrame()` per page, then `dispose()`.
 */
export class PointOfViewSnapshotGrid {
    readonly #instance: Livelink;
    readonly #surface: SnapshotSurface;
    readonly #cameras: Array<Entity>;
    readonly #viewports: Array<Viewport>;
    readonly #cols: number;
    readonly #tileWidth: number;
    readonly #tileHeight: number;
    readonly #scratchCanvas: HTMLCanvasElement;
    readonly #scratchContext: CanvasRenderingContext2D;

    #cancelled = false;

    /**
     * The number of points of view this grid can capture at once.
     */
    get cellCount(): number {
        return this.#cameras.length;
    }

    /**
     *
     */
    private constructor(params: {
        instance: Livelink;
        surface: SnapshotSurface;
        cameras: Array<Entity>;
        viewports: Array<Viewport>;
        cols: number;
        tileWidth: number;
        tileHeight: number;
    }) {
        this.#instance = params.instance;
        this.#surface = params.surface;
        this.#cameras = params.cameras;
        this.#viewports = params.viewports;
        this.#cols = params.cols;
        this.#tileWidth = params.tileWidth;
        this.#tileHeight = params.tileHeight;

        this.#scratchCanvas = document.createElement("canvas");
        this.#scratchCanvas.width = params.tileWidth;
        this.#scratchCanvas.height = params.tileHeight;
        this.#scratchContext = this.#scratchCanvas.getContext("2d")!;
    }

    /**
     * Creates a grid of `cellCount` temporary cameras, positioned to not overlap
     * `renderingSurface` once both are packed into the shared remote canvas.
     */
    static async create({
        instance,
        sceneSettings,
        renderingSurface,
        cellCount,
        tileWidth,
        tileHeight,
    }: {
        instance: Livelink;
        sceneSettings: Readonly<SceneSettingsRecord>;
        renderingSurface: RenderingSurfaceBase;
        cellCount: number;
        tileWidth: number;
        tileHeight: number;
    }): Promise<PointOfViewSnapshotGrid> {
        const cols = Math.ceil(Math.sqrt(cellCount));
        const rows = Math.ceil(cellCount / cols);

        const surface = new SnapshotSurface({
            width: cols * tileWidth,
            height: rows * tileHeight,
            offset: this.#computeGridOffset({
                renderingSurface,
                gridWidth: cols * tileWidth,
                gridHeight: rows * tileHeight,
            }),
        });

        const cameras = await instance.scene.newEntities({
            components_array: new Array(cellCount)
                .fill(null)
                .map(() => this.#makeSnapshotCameraComponents({ sceneSettings })),
            options: { delete_on_client_disconnection: true },
        });

        const viewports = cameras.map((cameraEntity, i) => {
            const viewport = new Viewport({
                core: instance,
                rendering_surface: surface,
                options: { rect: this.#cellRect({ index: i, cols, rows }) },
            });
            viewport.camera_projection = new CameraProjection({ camera_entity: cameraEntity, viewport });
            return viewport;
        });
        instance.addViewports({ viewports });

        return new PointOfViewSnapshotGrid({ instance, surface, cameras, viewports, cols, tileWidth, tileHeight });
    }

    /**
     * Moves this grid's cameras to `pointsOfView` (at most {@link cellCount} of them), waits for
     * the render to settle, and returns one cropped snapshot per point of view, in order.
     */
    async captureFrame(pointsOfView: Array<PointOfViewTransform>): Promise<Array<string | null>> {
        if (this.#cancelled) {
            return pointsOfView.map(() => null);
        }

        pointsOfView.forEach((pointOfView, i) => {
            this.#cameras[i].updateComponent("local_transform", {
                position: pointOfView.position,
                orientation: pointOfView.orientation,
            });
        });

        const settled = await this.#waitForSettle(pointsOfView);
        if (this.#cancelled) {
            return pointsOfView.map(() => null);
        }
        if (!settled) {
            console.warn("usePointOfViewSnapshots: some points of view did not settle in time, capturing anyway");
        }

        return pointsOfView.map((_, i) => this.#captureCell(i));
    }

    /**
     * Marks this grid as cancelled, so that any in-progress {@link captureFrame} call stops
     * waiting and returns as soon as possible.
     */
    cancel(): void {
        this.#cancelled = true;
    }

    /**
     * Tears down every viewport, the offscreen surface, and the temporary cameras.
     */
    async dispose(): Promise<void> {
        this.cancel();
        for (const viewport of this.#viewports) {
            this.#instance.removeViewport({ viewport });
        }
        this.#surface.release();
        await this.#instance.scene.deleteEntities({ entities: this.#cameras });
    }

    /**
     * Polls the server-reported camera position each frame — no public "frame drawn" event
     * exists, but position updates right before the canvas paints, so settled means ready.
     */
    #waitForSettle(pointsOfView: Array<PointOfViewTransform>): Promise<boolean> {
        return new Promise(resolve => {
            let frame = 0;
            let consecutiveSettledFrames = 0;
            // Checked once per animation frame until settled or SETTLE_MAX_FRAMES is reached.
            const check = (): void => {
                const settled = pointsOfView.every((pointOfView, i) =>
                    this.#isSettled(this.#viewports[i], pointOfView),
                );
                consecutiveSettledFrames = settled ? consecutiveSettledFrames + 1 : 0;

                if (consecutiveSettledFrames >= SETTLE_CONSECUTIVE_FRAMES) {
                    resolve(true);
                    return;
                }
                if (frame >= SETTLE_MAX_FRAMES || this.#cancelled) {
                    resolve(false);
                    return;
                }
                frame++;
                requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
        });
    }

    /**
     * Whether `viewport`'s last known camera position is close enough to `target`.
     */
    #isSettled(viewport: Viewport, target: PointOfViewTransform): boolean {
        const world_position = viewport.camera_projection!.world_position;
        const dx = world_position[0] - target.position[0];
        const dy = world_position[1] - target.position[1];
        const dz = world_position[2] - target.position[2];
        return dx * dx + dy * dy + dz * dz < SETTLE_POSITION_EPSILON * SETTLE_POSITION_EPSILON;
    }

    /**
     * Crops the grid cell at `index` out of the surface's canvas into a data URL.
     */
    #captureCell(index: number): string {
        const col = index % this.#cols;
        const row = Math.floor(index / this.#cols);

        this.#scratchContext.clearRect(0, 0, this.#tileWidth, this.#tileHeight);
        this.#scratchContext.drawImage(
            this.#surface.canvas,
            col * this.#tileWidth,
            row * this.#tileHeight,
            this.#tileWidth,
            this.#tileHeight,
            0,
            0,
            this.#tileWidth,
            this.#tileHeight,
        );
        return this.#scratchCanvas.toDataURL("image/jpeg", 0.85);
    }

    /**
     * The relative rect of grid cell `index` within a `cols` x `rows` grid.
     */
    static #cellRect({ index, cols, rows }: { index: number; cols: number; rows: number }): RelativeRect {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return new RelativeRect({ left: col / cols, top: row / rows, width: 1 / cols, height: 1 / rows });
    }

    /**
     * Positions a grid to the right of `renderingSurface` or below it, whichever keeps their
     * combined area smaller, so the two never overlap once packed into the shared remote canvas.
     */
    static #computeGridOffset({
        renderingSurface,
        gridWidth,
        gridHeight,
    }: {
        renderingSurface: RenderingSurfaceBase;
        gridWidth: number;
        gridHeight: number;
    }): { left: number; top: number } {
        const mainRect = renderingSurface.getBoundingRect();

        const rightArea = (mainRect.width + gridWidth) * Math.max(mainRect.height, gridHeight);
        const belowArea = Math.max(mainRect.width, gridWidth) * (mainRect.height + gridHeight);

        return rightArea <= belowArea
            ? { left: mainRect.right, top: mainRect.top }
            : { left: mainRect.left, top: mainRect.bottom };
    }

    /**
     * The components of a temporary camera entity used to render one grid cell, using the
     * scene's default render graph / lens settings the same way `useCameraEntity` does.
     */
    static #makeSnapshotCameraComponents({
        sceneSettings,
    }: {
        sceneSettings: Readonly<SceneSettingsRecord>;
    }): ComponentsManifest {
        /* eslint-disable prefer-const */
        let { renderGraphRef, dataJSON: settings, renderTargetIndex } = sceneSettings.default_camera_component;
        /* eslint-enable prefer-const */

        if (renderGraphRef === INVALID_RENDER_GRAPH_UUID) {
            renderGraphRef = DEFAULT_RENDER_GRAPH_UUID;
        }
        if (Object.keys(settings).length === 0) {
            settings = DEFAULT_RENDER_GRAPH_SETTINGS;
        }

        return {
            local_transform: { position: sceneSettings.default_camera_transform.position },
            camera: { renderGraphRef, dataJSON: settings, renderTargetIndex },
            perspective_lens: DEFAULT_PERSPECTIVE_LENS,
        };
    }
}

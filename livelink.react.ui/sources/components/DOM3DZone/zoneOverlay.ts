//------------------------------------------------------------------------------
import type { OverlayInterface, Viewport } from "@3dverse/livelink";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";

//------------------------------------------------------------------------------
/** Sharper than the stream where the screen allows it, at no more than this many pixels per CSS pixel. */
const MAX_PIXEL_RATIO = 2;

//------------------------------------------------------------------------------
/**
 * The entity zones' three.js, on a canvas of its own laid over the viewport, as Mitek's control zone
 * is drawn.
 *
 * It is one of the viewport's overlays, for the moment it is drawn: the viewport draws its overlays
 * with every frame it composites, so the zone is rendered with that frame's camera and never drifts
 * against the stream — and moves on as often as the stream does.
 * It hands the viewport no canvas back, which leaves the frame as it was.
 */
export class ZoneOverlay implements OverlayInterface {
    //--------------------------------------------------------------------------
    readonly scene = new Scene();
    readonly camera = new PerspectiveCamera();
    /** The canvas: as an overlay's container, the camera controller takes events on it as on the viewport. */
    readonly container: HTMLCanvasElement;
    /** Called with each frame before it is drawn, its camera placed: for the scene to move on to it. */
    beforeDraw: ((camera: PerspectiveCamera) => void) | null = null;
    readonly #viewport: Viewport;
    readonly #renderer: WebGLRenderer;

    //--------------------------------------------------------------------------
    constructor({ viewport, canvas }: { viewport: Viewport; canvas: HTMLCanvasElement }) {
        this.#viewport = viewport;
        this.container = canvas;
        this.#renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
        this.#renderer.setClearColor(0x000000, 0);
        this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
        this.resize();
        // Placed from the stream's camera each frame, as livelink-three's own overlay places its camera.
        this.camera.matrixAutoUpdate = false;
    }

    //--------------------------------------------------------------------------
    draw(): null {
        const projection = this.#viewport.camera_projection;
        if (projection) {
            const camera = this.camera;
            camera.position.fromArray(projection.world_position);
            camera.quaternion.fromArray(projection.world_orientation);
            camera.updateMatrix();
            camera.projectionMatrix.fromArray(projection.clip_from_view_matrix);
            camera.projectionMatrixInverse.fromArray(projection.view_from_clip_matrix);
            this.beforeDraw?.(camera);
            this.#renderer.render(this.scene, camera);
        }
        return null;
    }

    /** As large as the canvas shows: the viewport's size, in the stream's pixels, says nothing of the screen's. */
    resize(): void {
        this.#renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    }

    release(): void {
        this.#renderer.dispose();
    }
}

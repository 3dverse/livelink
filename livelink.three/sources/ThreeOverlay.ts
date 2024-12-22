import * as THREE from "three";
import type { CameraProjection, OverlayInterface, Viewport } from "@3dverse/livelink";

/**
 *
 */
export class ThreeOverlay implements OverlayInterface {
    /**
     *
     */
    #scene: THREE.Scene = new THREE.Scene();

    /**
     *
     */
    readonly camera: THREE.Camera;

    /**
     *
     */
    #viewport: Viewport;

    /**
     *
     */
    #renderer: THREE.WebGLRenderer;

    /**
     *
     */
    #offscreenCanvas: OffscreenCanvas;

    /**
     *
     */
    constructor({ viewport, scene }: { viewport: Viewport; scene: THREE.Scene }) {
        this.#scene = scene;
        this.#offscreenCanvas = new OffscreenCanvas(viewport.width, viewport.height);
        const context = this.#offscreenCanvas.getContext("webgl2");
        if (context === null) {
            throw new Error("Cannot create a WebGL2 context");
        }

        this.#renderer = new THREE.WebGLRenderer({ context, canvas: this.#offscreenCanvas });

        this.#renderer.setClearColor(0xffffff, 0);
        this.#renderer.setPixelRatio(1);
        this.#renderer.setSize(viewport.width, viewport.height, false);

        this.camera = new THREE.Camera();
        this.camera.matrixAutoUpdate = false;

        this.#viewport = viewport;
    }
    /**
     *
     */
    draw({ output_canvas }: { output_canvas: OffscreenCanvas | null }): OffscreenCanvas | null {
        const viewport_camera_projection = this.#viewport.camera_projection;
        if (!viewport_camera_projection) {
            return null;
        }

        this.#drawFrameForCamera({ viewport_camera_projection });

        if (output_canvas) {
            throw new Error("Not implemented");
        }

        return this.#offscreenCanvas;
    }

    /**
     *
     */
    #drawFrameForCamera({ viewport_camera_projection }: { viewport_camera_projection: CameraProjection }) {
        // Here we MUST NOT use the transform of the camera entity, but the one from the camera projection.
        this.camera.position.fromArray(viewport_camera_projection.world_position);
        this.camera.quaternion.fromArray(viewport_camera_projection.world_orientation);
        this.camera.updateMatrix();
        this.camera.projectionMatrix.fromArray(viewport_camera_projection.clip_from_view_matrix);

        this.#renderer.setViewport(0, 0, this.#viewport.width, this.#viewport.height);
        this.#renderer.render(this.#scene, this.camera);
    }

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void {
        this.#offscreenCanvas.width = width;
        this.#offscreenCanvas.height = height;
        this.#renderer.setSize(width, height, false);
    }

    /**
     *
     */
    release() {
        this.#renderer.dispose();
    }
}

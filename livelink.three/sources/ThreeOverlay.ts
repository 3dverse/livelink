import * as THREE from "three";
import type {
    CameraProjection,
    FrameMetaData,
    OverlayInterface,
    Viewport,
    FrameCameraTransform,
} from "@3dverse/livelink";

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
    draw({
        meta_data,
        output_canvas,
    }: {
        meta_data: FrameMetaData;
        output_canvas: OffscreenCanvas | null;
    }): OffscreenCanvas | null {
        const viewport_camera_projection = this.#viewport.camera_projection;
        if (!viewport_camera_projection) {
            return null;
        }

        const metadata = meta_data.current_client_camera_entities.find(
            ({ camera_entity }) => camera_entity.id === viewport_camera_projection.camera_entity.id,
        );
        if (!metadata) {
            console.error("No metadata found for camera", viewport_camera_projection.camera_entity.id);
            return null;
        }

        this.#drawFrameForCamera({ metadata, viewport_camera_projection });

        if (output_canvas) {
            throw new Error("Not implemented");
        }

        return this.#offscreenCanvas;
    }

    /**
     *
     */
    #drawFrameForCamera({
        metadata,
        viewport_camera_projection,
    }: {
        metadata: FrameCameraTransform;
        viewport_camera_projection: CameraProjection;
    }) {
        this.camera.position.fromArray(metadata.world_position);
        this.camera.quaternion.fromArray(metadata.world_orientation);
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

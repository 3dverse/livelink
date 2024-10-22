import * as THREE from "three";
import type { CurrentFrameMetaData, FrameCameraTransform, OverlayInterface, Viewport, UUID } from "@3dverse/livelink";

/**
 *
 */
export class ThreeJS_Overlay implements OverlayInterface {
    /**
     *
     */
    #scene: THREE.Scene = new THREE.Scene();

    /**
     *
     */
    #viewports: Map<UUID, { camera: THREE.Camera; viewport: Viewport }> = new Map();

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
    #dimensions: THREE.Vector2;

    /**
     *
     */
    constructor({ canvas, scene }: { canvas: HTMLCanvasElement; scene: THREE.Scene }) {
        this.#scene = scene;
        this.#offscreenCanvas = new OffscreenCanvas(canvas.clientWidth, canvas.clientHeight);
        const context = this.#offscreenCanvas.getContext("webgl2");
        if (context === null) {
            throw new Error("Cannot create a WebGL2 context");
        }

        this.#renderer = new THREE.WebGLRenderer({ context, canvas: this.#offscreenCanvas });

        this.#renderer.autoClear = false;
        this.#renderer.setClearColor(0xffffff, 0);
        this.#renderer.setPixelRatio(1);
        this.#renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.#dimensions = new THREE.Vector2(canvas.clientWidth, canvas.clientHeight);
    }

    /**
     *
     */
    addViewport({ viewport }: { viewport: Viewport }) {
        if (!viewport.camera) {
            console.error("Viewport has no camera", viewport);
            return;
        }

        const camera = new THREE.Camera();
        camera.matrixAutoUpdate = false;
        this.#viewports.set(viewport.camera.id!, { camera, viewport });
    }

    /**
     *
     */
    drawFrame({ meta_data }: { meta_data: CurrentFrameMetaData }): OffscreenCanvas {
        for (const [cameraUUID, { camera, viewport }] of this.#viewports) {
            const metadata = meta_data.cameras.find(({ camera }) => camera.id === cameraUUID);
            if (!metadata) {
                console.error("No metadata found for camera", cameraUUID);
                continue;
            }

            this.#drawFrameForCamera({ viewport, camera, metadata });
        }

        return this.#offscreenCanvas;
    }

    /**
     *
     */
    #drawFrameForCamera({
        viewport,
        camera,
        metadata,
    }: {
        viewport: Viewport;
        camera: THREE.Camera;
        metadata: FrameCameraTransform;
    }) {
        const [offsetX, offsetY] = viewport.offset;

        camera.position.fromArray(metadata.world_position);
        camera.quaternion.fromArray(metadata.world_orientation);
        camera.updateMatrix();
        camera.projectionMatrix.fromArray(viewport.camera!.clip_from_view_matrix);

        this.#renderer.setScissor(
            offsetX,
            this.#dimensions.y - offsetY - viewport.height,
            viewport.width,
            viewport.height,
        );
        this.#renderer.setScissorTest(true);
        this.#renderer.clear();
        this.#renderer.setScissorTest(false);

        this.#renderer.setViewport(
            offsetX,
            this.#dimensions.y - offsetY - viewport.height,
            viewport.width,
            viewport.height,
        );

        this.#renderer.render(this.#scene, camera);
    }

    /**
     *
     */
    resize({ width, height }: { width: number; height: number }): void {
        this.#offscreenCanvas.width = width;
        this.#offscreenCanvas.height = height;
        this.#renderer.setSize(width, height, false);
        this.#dimensions.set(width, height);

        for (const { camera, viewport } of this.#viewports.values()) {
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = viewport.width / viewport.height;
                camera.updateProjectionMatrix();
            }
        }
    }

    /**
     *
     */
    release() {
        this.#renderer.dispose();
    }
}

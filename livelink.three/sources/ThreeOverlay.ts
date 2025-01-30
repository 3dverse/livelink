import * as THREE from "three";
import type {
    CameraProjection,
    Components,
    Entity,
    EntityUpdatedEvent,
    OverlayInterface,
    Viewport,
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
    #camera: THREE.Camera;

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
    #event_abort_controller: AbortController = new AbortController();

    /**
     *
     */
    constructor({
        viewport_camera_projection,
        scene,
    }: {
        viewport_camera_projection: CameraProjection;
        scene: THREE.Scene;
    }) {
        this.#scene = scene;
        this.#viewport = viewport_camera_projection.viewport;
        this.#offscreenCanvas = new OffscreenCanvas(this.#viewport.width, this.#viewport.height);
        const context = this.#offscreenCanvas.getContext("webgl2");
        if (!context) {
            throw new Error("Cannot create a WebGL2 context");
        }

        this.#renderer = new THREE.WebGLRenderer({ context, canvas: this.#offscreenCanvas });

        this.#renderer.setClearColor(0xffffff, 0);
        this.#renderer.setPixelRatio(1);
        this.#renderer.setSize(this.#viewport.width, this.#viewport.height, false);

        this.#camera = this.#setupCameraProjection();
    }

    /**
     *
     */
    get camera(): Readonly<THREE.Camera> {
        return this.#camera;
    }

    /**
     *
     */
    get scene() {
        return this.#scene;
    }

    /**
     * Create a THREE.Camera from the camera_projection component of the viewport,
     */
    #setupCameraProjection(): THREE.Camera {
        const cameraEntity = this.#viewport.camera_projection?.camera_entity;
        if (!cameraEntity) {
            throw new Error("Viewport has no camera_projection");
        }

        const perspective_lens = cameraEntity.perspective_lens;
        const orthographic_lens = cameraEntity.orthographic_lens;

        // Unregister the previous entity update handlers.
        this.#event_abort_controller.abort();
        this.#event_abort_controller = new AbortController();

        if (perspective_lens) {
            this.#camera = this.#setupPerspectiveLens({ cameraEntity, perspective_lens });
        } else if (orthographic_lens) {
            this.#camera = this.#setupOrthographicLens({ cameraEntity, orthographic_lens });
        } else {
            throw new Error("Camera entity has no perspective_lens or orthographic_lens component");
        }

        this.#camera.matrixAutoUpdate = false;
        return this.#camera;
    }

    /**
     * Create a THREE.PerspectiveCamera from a perspective_lens component,
     * and update it when the perspective_lens component is updated.
     * Whenever the perspective_lens component is deleted, #setupCameraProjection is called
     * to re-create the camera.
     */
    #setupPerspectiveLens({
        cameraEntity,
        perspective_lens,
    }: {
        cameraEntity: Entity;
        perspective_lens: Components.PerspectiveLens;
    }): THREE.PerspectiveCamera {
        const perspectiveCamera = new THREE.PerspectiveCamera();
        const INFINITE_FAR_VALUE = 100000;

        const applyLens = (perspective_lens: Components.PerspectiveLens) => {
            perspectiveCamera.aspect = this.#viewport.aspect_ratio;
            perspectiveCamera.fov = perspective_lens.fovy;
            perspectiveCamera.near = perspective_lens.nearPlane;
            perspectiveCamera.far = perspective_lens.farPlane || INFINITE_FAR_VALUE;
        };

        const entity_update_handler = (event: EntityUpdatedEvent) => {
            if (event.deleted_components.includes("perspective_lens")) {
                this.#setupCameraProjection();
                return;
            }

            if (event.updated_components.includes("perspective_lens")) {
                applyLens(cameraEntity.perspective_lens!);
            }
        };

        cameraEntity.addEventListener("on-entity-updated", entity_update_handler, {
            signal: this.#event_abort_controller.signal,
        });

        applyLens(perspective_lens);
        return perspectiveCamera;
    }

    /**
     * Create a THREE.OrthographicCamera from an orthographic_lens component,
     * and update it when the orthographic_lens component is updated.
     * Whenever the orthographic_lens component is deleted, #setupCameraProjection is called
     * to re-create the camera.
     */
    #setupOrthographicLens({
        cameraEntity,
        orthographic_lens,
    }: {
        cameraEntity: Entity;
        orthographic_lens: Components.OrthographicLens;
    }): THREE.OrthographicCamera {
        const orthographicCamera = new THREE.OrthographicCamera();

        const applyLens = (orthographic_lens: Components.OrthographicLens) => {
            orthographicCamera.left = orthographic_lens.left;
            orthographicCamera.right = orthographic_lens.right;
            orthographicCamera.top = orthographic_lens.top;
            orthographicCamera.bottom = orthographic_lens.bottom;
            orthographicCamera.near = orthographic_lens.zNear;
            orthographicCamera.far = orthographic_lens.zFar;
        };

        const entity_update_handler = (event: EntityUpdatedEvent) => {
            if (event.deleted_components.includes("orthographic_lens")) {
                this.#setupCameraProjection();
                return;
            }

            if (event.updated_components.includes("orthographic_lens")) {
                applyLens(cameraEntity.orthographic_lens!);
            }
        };

        cameraEntity.addEventListener("on-entity-updated", entity_update_handler, {
            signal: this.#event_abort_controller.signal,
        });

        applyLens(orthographic_lens);
        return orthographicCamera;
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
        this.#camera.position.fromArray(viewport_camera_projection.world_position);
        this.#camera.quaternion.fromArray(viewport_camera_projection.world_orientation);
        this.#camera.updateMatrix();
        this.#camera.projectionMatrix.fromArray(viewport_camera_projection.clip_from_view_matrix);
        this.#camera.projectionMatrixInverse.fromArray(viewport_camera_projection.view_from_clip_matrix);

        this.#renderer.setViewport(0, 0, this.#viewport.width, this.#viewport.height);
        this.#renderer.render(this.#scene, this.#camera);
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
        this.#event_abort_controller.abort();
        this.#renderer.dispose();
    }
}

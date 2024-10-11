import * as THREE from "three";
import type { CurrentFrameMetaData, OverlayInterface, Viewport, UUID, Camera } from "@3dverse/livelink";
import type { Components } from "@3dverse/livelink.core";
import { CameraFrameTransform } from "@3dverse/livelink/dist/sources/decoders/CameraFrameTransform";

/**
 *
 */
const INFINITE_FAR_VALUE = 100000;

/**
 *
 */
type THREE_Camera = THREE.Camera & { onEntityUpdated: () => void };

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
    #viewports: Map<UUID, { camera: THREE_Camera; viewport: Viewport }> = new Map();

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

        if (this.#viewports.has(viewport.camera.id!)) {
            const { viewport: v, camera } = this.#viewports.get(viewport.camera.id!)!;
            v.camera!.removeEventListener("entity-updated", camera.onEntityUpdated);
        }

        let camera: THREE_Camera;
        if (viewport.camera.perspective_lens) {
            camera = this.#setupPerspectiveLens({ viewport, camera: viewport.camera });
        } else if (viewport.camera.orthographic_lens) {
            camera = this.#setupOrthographicLens({ camera: viewport.camera });
        } else {
            console.error("Viewport has no projection lens", viewport);
            return;
        }

        //FIXME: this should be the global transform
        if (!viewport.camera.local_transform) {
            console.error("Viewport camera has no local transform", viewport);
            return;
        }

        const camera_transform = viewport.camera.local_transform as Required<Components.LocalTransform>;

        camera.position.set(...camera_transform.position);
        camera.quaternion.set(...camera_transform.orientation);

        viewport.camera.addEventListener("entity-updated", camera.onEntityUpdated);
        camera.onEntityUpdated();
        this.#viewports.set(viewport.camera.id!, { camera, viewport });
    }

    /**
     *
     */
    #setupPerspectiveLens({ viewport, camera }: { viewport: Viewport; camera: Camera }): THREE_Camera {
        const lens = camera.perspective_lens as Required<Components.PerspectiveLens>;
        const perspectiveCamera = new THREE.PerspectiveCamera();

        const threeCamera = perspectiveCamera as unknown as THREE_Camera;
        threeCamera.onEntityUpdated = () => {
            perspectiveCamera.aspect = viewport.width / viewport.height;
            perspectiveCamera.fov = lens.fovy;
            perspectiveCamera.near = lens.nearPlane;
            perspectiveCamera.far = lens.farPlane || INFINITE_FAR_VALUE;
            perspectiveCamera.updateProjectionMatrix();
        };

        return perspectiveCamera as unknown as THREE_Camera;
    }

    /**
     *
     */
    #setupOrthographicLens({ camera }: { camera: Camera }): THREE_Camera {
        const lens = camera.orthographic_lens as Required<Components.OrthographicLens>;
        const orthographicCamera = new THREE.OrthographicCamera();

        const threeCamera = orthographicCamera as unknown as THREE_Camera;
        threeCamera.onEntityUpdated = () => {
            orthographicCamera.left = lens.left;
            orthographicCamera.right = lens.right;
            orthographicCamera.top = lens.top;
            orthographicCamera.bottom = lens.bottom;
            orthographicCamera.near = lens.zNear;
            orthographicCamera.far = lens.zFar;
            orthographicCamera.updateProjectionMatrix();
        };

        return orthographicCamera as unknown as THREE_Camera;
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
        camera: THREE_Camera;
        metadata: CameraFrameTransform;
    }) {
        const [offsetX, offsetY] = viewport.offset;

        camera.position.set(...metadata.position);
        camera.quaternion.set(...metadata.orientation);

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

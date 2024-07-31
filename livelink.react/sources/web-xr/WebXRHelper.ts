//------------------------------------------------------------------------------
import { Camera, Livelink, OffscreenSurface, RelativeRect, Viewport, Vec3, Quat } from "@3dverse/livelink";
import { XRContext } from "@3dverse/livelink-react/sources/web-xr/XRContext";
import { Quaternion, Vector3, Euler } from "three";

//------------------------------------------------------------------------------
export class WebXRCamera extends Camera {
    onCreate(): void {
        // TODO: WebXRHelper.cameras_origin as an Entity might be a better
        // approach to have a camera default origin but the FTL engine crashes
        // when trying to set parent (lineage) of the camera. Actually it
        // crashes a few time after, but reparenting is visible in the scene graph.
        // this.lineage = { parentUUID: WebXRHelper.cameras_origin!.id! };
        this.local_transform = {};
        this.perspective_lens = {};
        this.camera = {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: false, displayBackground: false },
        };
    }
}

//------------------------------------------------------------------------------
type XRViewports = Array<{
    xr_view: XRView;
    livelink_viewport: Viewport;
}>;

//------------------------------------------------------------------------------
function createPromiseWithResolvers<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolve: (value: T) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return { promise, resolve: resolve!, reject: reject! };
}

//------------------------------------------------------------------------------
export type CamerasOriginTransform = {
    position: Vec3;
    orientation: Quat;
};

//------------------------------------------------------------------------------
export class WebXRHelper {
    //--------------------------------------------------------------------------
    // TODO: a better approach (cameras with a parent entity) than relying on
    // cameras_origin & center_eye. It'd be static because to be used from
    // WebXRCamera.onCreate() but it's not the right interface, we'd need a way
    // to create an entity and set parent after creation (does not work so far),
    // or place cameras_origin inside the Viewport to make it accessible from
    // WebXRCamera.onCreate().
    // static cameras_origin: Entity | null = null;
    //--------------------------------------------------------------------------
    /**
     * Use it to shift the XRView camera transforms
     */
    cameras_origin: CamerasOriginTransform | null = null;

    //--------------------------------------------------------------------------
    // References to livelink core
    #liveLink: Livelink | null = null;

    //--------------------------------------------------------------------------
    #surface: OffscreenSurface<"webgl", { xrCompatible: boolean }>;
    #fov_factor: number = 1.15;
    #camera_fovy: number = 60;
    #viewports: XRViewports = [];
    #context: XRContext;

    //--------------------------------------------------------------------------
    // WebXR API references
    session: XRSession | null = null;
    #reference_space: XRReferenceSpace | null = null;
    #xr_viewports: XRViewport[] = [];
    #animationFrameRequestId: number = 0;

    //--------------------------------------------------------------------------
    /**
     * Test if the provided XR session mode is supported by this browser.
     * @param sessionMode defines the XR session mode to test
     * @returns Resolves with boolean indicating if the provided session mode is
     * supported.
     */
    public static async isSessionSupported(mode: XRSessionMode): Promise<boolean> {
        if (!navigator.xr) {
            return false;
        }
        // When the specs are final, remove supportsSession!
        // https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/isSessionSupported
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isSessionSupportedFunction = navigator.xr.isSessionSupported || (navigator.xr as any).supportsSession;
        if (!isSessionSupportedFunction) {
            return false;
        }
        const isSupported = await isSessionSupportedFunction.call(navigator.xr, mode).catch(console.warn);
        return isSupported ?? false;
    }

    //--------------------------------------------------------------------------
    constructor() {
        this.#surface = new OffscreenSurface({
            width: window.innerWidth, // Not sure
            height: window.innerHeight, // Really not sure
            context_constructor: XRContext,
            context_type: "webgl",
            context_options: { xrCompatible: true },
        });
        this.#context = this.#surface.context as XRContext;
    }

    //--------------------------------------------------------------------------
    public async release(): Promise<void> {
        this.#surface?.release();
        if (this.#animationFrameRequestId) {
            this.session?.cancelAnimationFrame(this.#animationFrameRequestId);
        }
        return this.session?.end().catch(error => console.warn("Could not end XR session:", error));
    }

    //--------------------------------------------------------------------------
    get fakeAlpha() {
        return this.#context.fake_alpha_enabled;
    }

    //--------------------------------------------------------------------------
    set fakeAlpha(value: boolean) {
        this.#context.fake_alpha_enabled = value;
    }

    //--------------------------------------------------------------------------
    public async initialize(mode: XRSessionMode, options: XRSessionInit = {}): Promise<void> {
        if (!WebXRHelper.isSessionSupported(mode)) {
            throw new Error(`WebXR "${mode}" not supported`);
        }

        const spaceTypes: Array<XRReferenceSpaceType | undefined> = ["local-floor", "local"];
        let lastError: unknown;

        for (const spaceType of spaceTypes) {
            const sessionOptions: XRSessionInit = spaceType
                ? { ...options, requiredFeatures: [...(options.requiredFeatures || []), spaceType] }
                : options;

            try {
                this.session = await navigator.xr!.requestSession(mode, sessionOptions);
                await this.updateRenderState();
                await this.setReferenceSpaceType(spaceType);
                return;
            } catch (error) {
                console.warn(
                    "Failed to request XR session",
                    { spaceType, requiredFeatures: sessionOptions.requiredFeatures },
                    error,
                );
                this.session?.end();
                lastError = error;
            }
        }

        if (!this.session) {
            throw lastError;
        }
    }

    //--------------------------------------------------------------------------
    public async configureViewports(livelink: Livelink, enableScale: boolean = false): Promise<void> {
        this.#liveLink = livelink;
        if (!this.#liveLink) {
            throw new Error("Failed to configure XR session, no LiveLink instance was provided.");
        }

        const xr_views = await this.#getXRViews();

        this.#configureLivelinkViewports(xr_views);
        if (enableScale) {
            this.#configureScaleFactor(xr_views);
        }

        this.#liveLink!.addViewports({ viewports: this.#viewports.map(v => v.livelink_viewport) });
    }

    //--------------------------------------------------------------------------
    /**
     * Obtains a single set of XR views from the XR session.
     */
    #getXRViews(): Promise<Readonly<Array<XRView>>> {
        const { promise, resolve, reject } = createPromiseWithResolvers<Readonly<Array<XRView>>>();

        let remaining_attempts = 200;
        const onFirstXRFrame = async (_: DOMHighResTimeStamp, frame: XRFrame) => {
            const xr_views = frame.getViewerPose(this.#reference_space!)?.views;
            if (!xr_views) {
                if (--remaining_attempts > 0) {
                    this.session!.requestAnimationFrame(onFirstXRFrame);
                } else {
                    reject(new Error("Failed to get XR views."));
                }
                return;
            }

            resolve(xr_views);
        };

        this.#animationFrameRequestId = this.session!.requestAnimationFrame(onFirstXRFrame);
        return promise;
    }

    //--------------------------------------------------------------------------
    #configureScaleFactor(xr_views: Readonly<Array<XRView>>): void {
        const fovY = xr_views[0].projectionMatrix[5];
        const original_fov = 2 * Math.atan(1 / fovY);

        const new_fov = original_fov * this.#fov_factor;
        this.#surface.resolution_scale = (Math.tan(new_fov / 2) / Math.tan(original_fov / 2)) * 2;
        this.#context.scale_factor = this.#surface.resolution_scale;

        this.#camera_fovy = new_fov * (180 / Math.PI);

        console.log(
            `%cFOV: ${original_fov * (180 / Math.PI)} -> ${this.#camera_fovy}, scale factor: ${this.#context.scale_factor}`,
            "color: orange; font-weight: bold; font-size: 1.5em",
        );
    }

    //--------------------------------------------------------------------------
    public start(): void {
        this.session!.requestAnimationFrame(this.#onXRFrame);
    }

    //--------------------------------------------------------------------------
    /**
     * Sets the reference space of the XR session
     * @param type - https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestReferenceSpace#type
     * @returns Resolves with the reference to the new reference space.
     */
    public async setReferenceSpaceType(type: XRReferenceSpaceType = "local"): Promise<XRReferenceSpace> {
        this.#reference_space = await this.session!.requestReferenceSpace(type).catch(async error => {
            console.error(`Failed to request XR reference space of type ${type}:`, error);
            throw error;
        });
        return this.#reference_space;
    }

    //--------------------------------------------------------------------------
    /**
     * Update the XRSesssion render state with the native WebGLREnderingContext
     * of the viewport's ContextWebGL.
     * @param layer_init
     * @returns Resolves when the render state is updated.
     */
    public async updateRenderState(layer_init: XRWebGLLayerInit = {}): Promise<void> {
        const session = this.session!;
        const baseLayer = new XRWebGLLayer(session, this.#context.native, layer_init);
        await session.updateRenderState({ baseLayer });
        this.#context.frame_buffer = baseLayer.framebuffer;
        this.#surface!.resize(baseLayer.framebufferWidth, baseLayer.framebufferHeight);
    }

    //--------------------------------------------------------------------------
    /**
     * Apply a transformation on the single eye of the XR device. Transform is
     * expressed with a position vector and an orientation quaternion.
     * @param param0
     * @returns
     */
    #transformSingleEye({
        eye,
        transform,
        inverse = false,
    }: {
        eye: { position: Vec3, orientation: Quat };
        transform: { position: Vec3, orientation: Quat };
        inverse?: boolean;
    }) {
        // TODO: this might probably be more clear and efficient if implemented
        // with matrix operations.
        // Transformation to apply
        const transform_tjs = {
            position: new Vector3(...transform.position),
            quaternion: new Quaternion(...transform.orientation),
        };
        const eye_tjs = {
            position: new Vector3(...eye.position),
            quaternion: new Quaternion(...eye.orientation),
        };
        if(inverse) {
            transform_tjs.quaternion.invert();
            eye_tjs.position.sub(transform_tjs.position);
        } else {
            eye_tjs.position.add(transform_tjs.position);
        }
        eye_tjs.quaternion.premultiply(transform_tjs.quaternion);
        return {
            position: eye_tjs.position.toArray() as Vec3,
            orientation: eye_tjs.quaternion.toArray() as Quat,
        };
    }

    //--------------------------------------------------------------------------
    /**
     * Apply a transformation on the eyes of an headset. Transform is expressed
     * with a position vector and an orientation quaternion. Eyes order does
     * not matter.
     */
    #transformEyes({
        eye1,
        eye2,
        transform,
        inverse = false,
    }: {
        eye1: { position: Vec3, orientation: Quat };
        eye2: { position: Vec3, orientation: Quat };
        transform: { position: Vec3, orientation: Quat };
        inverse?: boolean;
    }) {
        // TODO: this might probably be more clear and efficient if implemented
        // with matrix operations.
        // Eyes: order does not matter
        const eye1_tjs = {
            position: new Vector3(...eye1.position),
            quaternion: new Quaternion(...eye1.orientation),
        };
        const eye2_tjs = {
            position: new Vector3(...eye2.position),
            quaternion: new Quaternion(...eye2.orientation),
        };
        // Transformation to apply
        const transform_tjs = {
            position: new Vector3(...transform.position),
            quaternion: new Quaternion(...transform.orientation),
        };

        // Calculate the center eye
        const center_eye = {
            position: eye1_tjs.position.clone().add(eye2_tjs.position).multiplyScalar(0.5),
            // quaternion: eye1_tjs.quaternion.clone().slerp(eye2_tjs.quaternion, 0.5),
        }
        // Apply the transformation on the center eye
        // (transform_tjs.quaternion not applied because it is done directly on eyes)
        const transformed_center_eye = {
            position: center_eye.position.clone(),
            // quaternion: center_eye.quaternion.clone(),
        }
        if(inverse) {
            // Inverse of the transform quaternion
            transform_tjs.quaternion.invert();
            transformed_center_eye.position.sub(transform_tjs.position);
        } else {
            transformed_center_eye.position.add(transform_tjs.position);
        }
        // not used but still worth to know how it's computed
        // transformed_center_eye.quaternion.premultiply(transform_tjs.quaternion);

        // Apply the transformation for eye1 and eye2
        const eyes = [eye1_tjs, eye2_tjs];
        eyes.forEach(eye => {
            eye.position.sub(center_eye.position).applyQuaternion(transform_tjs.quaternion).add(transformed_center_eye.position);
            eye.quaternion.premultiply(transform_tjs.quaternion);
        });

        const [transformed_eye1, transformed_eye2 ] = eyes.map(eye => ({
            position: eye.position.toArray() as Vec3,
            orientation: eye.quaternion.toArray() as Quat,
        }));
        return {
            eye1: transformed_eye1,
            eye2: transformed_eye2,
        };
    }

    //--------------------------------------------------------------------------
    /**
     * Apply this.#cameras_origin transformation on the eye(s) to shift the
     * eye(s) transform in the world.
     * @param cameras
     */
    #applyCamerasOrigin(cameras: readonly Camera[]) {
        if(!this.cameras_origin) {
            return;
        }
        // TODO: we probably shall identify the number of eyese better than
        // relying only on the number of cameras.
        if(cameras.length === 2) {
            const camera1 = cameras[0];
            const camera2 = cameras[1];
            const eye1_transform = {
                position: camera1.local_transform!.position!,
                orientation: camera1.local_transform!.orientation!,
            };
            const eye2_transform = {
                position: camera2.local_transform!.position!,
                orientation: camera2.local_transform!.orientation!,
            };
            const { eye1, eye2 } = this.#transformEyes({
                eye1: eye1_transform,
                eye2: eye2_transform,
                transform: this.cameras_origin,
                inverse: false,
            });
            camera1.local_transform = {
                position: eye1.position,
                orientation: eye1.orientation,
            };
            cameras[1].local_transform = {
                position: eye2.position,
                orientation: eye2.orientation,
            };
            return;
        }
        if(cameras.length === 1) {
            const camera = cameras[0];
            const eye_transform = {
                position: camera.local_transform!.position!,
                orientation: camera.local_transform!.orientation!,
            };
            camera.local_transform = this.#transformSingleEye({
                eye: eye_transform,
                transform: this.cameras_origin,
                inverse: false,
            });
        }
    }

    //--------------------------------------------------------------------------
    /**
     * Unapply this.#cameras_origin transformation on the eye(s) to shift back
     * the eye(s) transform in the world. This is to find back the original
     * transform of the headset eyes to place the billboard. We must apply this
     * inverse transform because we want to use the frame_camera_transform and
     * not the XRView.transform to place the billboard.
     * @param views
     */
    #unapplyCamerasOrigin(views: {
        frame_camera_transform: {
            position: Vec3,
            orientation: Quat,
        }
    }[]) {
        if(!this.cameras_origin) {
            return;
        }
        // TODO: we probably shall identify the number of eyese better than
        // relying only on the number of cameras.
        if(views.length === 2) {
            const view1 = views[0];
            const view2 = views[1];
            const { eye1, eye2 } = this.#transformEyes({
                eye1: view1.frame_camera_transform,
                eye2: view2.frame_camera_transform,
                transform: this.cameras_origin,
                inverse: true,
            });
            view1.frame_camera_transform = {
                position: eye1.position,
                orientation: eye1.orientation,
            };
            view2.frame_camera_transform = {
                position: eye2.position,
                orientation: eye2.orientation,
            };
            return;
        }
        if(views.length === 1) {
            const view = views[0];
            view.frame_camera_transform = this.#transformSingleEye({
                eye: view.frame_camera_transform,
                transform: this.cameras_origin,
                inverse: true,
            });
        }
    }

    //--------------------------------------------------------------------------
    /**
     * The XR session's animation frame loop.
     * @param time
     * @param frame
     */
    #onXRFrame = (_: DOMHighResTimeStamp, frame: XRFrame) => {
        const session = this.session!;
        const gl_layer = session.renderState.baseLayer!;
        const xr_views = frame.getViewerPose(this.#reference_space!)?.views?.map(view => ({
            view,
            viewport: gl_layer.getViewport(view)!,
        }));

        if (!xr_views) {
            session.requestAnimationFrame(this.#onXRFrame);
            return;
        }

        if (this.#xrViewportsHasChanged(xr_views)) {
            // For now, we end the session if the viewports have changed
            session.end();
        }

        this.#updateLiveLinkCameras(xr_views);

        if (this.#context.meta_data) {
            const views = xr_views.map(({ view, viewport }, index) => {
                const current_viewport = this.#surface.viewports[index];
                let { position, orientation } = this.#context.meta_data!.cameras.find(
                    c => c.camera.id === current_viewport.camera!.id,
                )!;
                return {
                    view,
                    viewport,
                    frame_camera_transform: { position, orientation }
                };
            });

            this.#unapplyCamerasOrigin(views);
            this.#context.drawXRFrame({ xr_views: views });
        }

        session.requestAnimationFrame(this.#onXRFrame);
    };

    //--------------------------------------------------------------------------
    /**
     * Update the cameras of the LiveLink instance.
     */
    #updateLiveLinkCameras(xr_views: Array<{ view: XRView }>): void {
        const cameras = this.#surface!.cameras;

        cameras.forEach((camera, index) => {
            const { view } = xr_views[index];
            const { position: pos, orientation: quat } = view.transform;
            const position = [pos.x, pos.y, pos.z] as Vec3;
            const orientation = [quat.x, quat.y, quat.z, quat.w] as Quat;

            // Update the local_transform component
            camera!.local_transform = { position, orientation };
        });
        this.#applyCamerasOrigin(cameras);
    }

    //--------------------------------------------------------------------------
    #configureLivelinkViewports(xr_views: readonly XRView[]) {
        const gl_layer = this.session!.renderState.baseLayer!;
        const xr_eyes = xr_views.map(view => ({
            view,
            viewport: gl_layer.getViewport(view)!,
        }));
        const xr_viewports = xr_eyes.map(xr_eye => xr_eye.viewport);

        console.debug("XR views:", xr_views);
        console.debug("XR viewports:", xr_viewports);
        this.#xr_viewports = xr_viewports;

        const are_xr_viewport_normalized = xr_eyes.every(({ viewport: v }) => {
            return v.x <= 1 && v.y <= 1 && v.width <= 1 && v.height <= 1;
        });

        this.#viewports.length = 0;

        for (const xr_eye of xr_eyes) {
            const xrViewport = xr_eye.viewport;
            const rect = new RelativeRect(
                are_xr_viewport_normalized
                    ? {
                          left: xrViewport.x,
                          top: xrViewport.y,
                          width: xrViewport.width,
                          height: xrViewport.height,
                      }
                    : {
                          left: xrViewport.x / gl_layer.framebufferWidth,
                          top: xrViewport.y / gl_layer.framebufferHeight,
                          width: xrViewport.width / gl_layer.framebufferWidth,
                          height: xrViewport.height / gl_layer.framebufferHeight,
                      },
            );
            console.debug(`Viewport for ${xr_eye.view.eye} eye:`, rect);
            const viewport = new Viewport(this.#liveLink!, this.#surface!, { rect });

            this.#viewports.push({
                xr_view: xr_eye.view,
                livelink_viewport: viewport,
            });
        }
    }

    //--------------------------------------------------------------------------
    async createCameras(): Promise<WebXRCamera[]> {
        const cameras = (await Promise.all(
            this.#viewports.map(async ({ xr_view, livelink_viewport }) => {
                const perspective_lens = this.#computePerspectiveLens(
                    xr_view.projectionMatrix,
                    livelink_viewport.width,
                    livelink_viewport.height,
                );

                const camera = await this.#liveLink!.newCamera(
                    WebXRCamera,
                    `XR_camera_${xr_view.eye}`,
                    livelink_viewport,
                );
                camera.perspective_lens = perspective_lens;
                return camera;
            }),
        ));

        return cameras;
    }

    //--------------------------------------------------------------------------
    /**
     * Extract the attributes of the perspective lens component from a
     * projection matrix and a viewport size.
     * @param projectionMatrix
     * @param viewportWidth
     * @param viewportHeight
     */
    #computePerspectiveLens(
        projectionMatrix: Float32Array,
        viewportWidth: number,
        viewportHeight: number,
    ): {
        fovy: number;
        aspectRatio: number;
        nearPlane: number;
        farPlane: number;
    } {
        const aspectRatio = viewportWidth / viewportHeight;
        const fovy = this.#camera_fovy;
        // Extract near and far clipping planes from the projection matrix
        const nearPlane = projectionMatrix[14] / (projectionMatrix[10] - 1);
        const farPlane = projectionMatrix[14] / (projectionMatrix[10] + 1);
        return { fovy, aspectRatio, nearPlane, farPlane };
    }

    //--------------------------------------------------------------------------
    /**
     * Check if the XRViewport instances passed as parameters are distinct from
     * the ones of the last XRFrame.
     * @param xr_views
     */
    #xrViewportsHasChanged(xr_views: Array<{ viewport: XRViewport }>): boolean {
        if (this.#xr_viewports.length === 0) {
            return true;
        }
        return xr_views.some(({ viewport }, index) => {
            const xr_viewport = this.#xr_viewports[index];
            if (!xr_viewport) {
                return true;
            }
            return (
                xr_viewport.width !== viewport.width ||
                xr_viewport.height !== viewport.height ||
                xr_viewport.x !== viewport.x ||
                xr_viewport.y !== viewport.y
            );
        });
    }
}

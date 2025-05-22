//------------------------------------------------------------------------------
import {
    Livelink,
    OffscreenSurface,
    RelativeRect,
    Viewport,
    Vec3,
    Quat,
    Entity,
    CameraProjection,
    RenderGraphDataObject,
    Transform,
} from "@3dverse/livelink";
import { XRContext } from "./XRContext";
import { Quaternion, Vector3, Matrix4 } from "threejs-math";

//------------------------------------------------------------------------------
type XRViewports = Array<{
    xr_view: XRView;
    xr_viewport: XRViewport;
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
/**
 * @experimental
 */
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
     * Use cameras origin to shift the pose of the XRView
     */
    cameras_origin: Omit<Transform, "eulerOrientation"> | null = null;
    #cameras_origin_apply: (cameras: readonly Entity[]) => void;
    #cameras_origin_unapply: (frame_camera_transforms: Pick<Transform, "position" | "orientation">[]) => void;

    //--------------------------------------------------------------------------
    // References to livelink core
    #core: Livelink | null = null;

    //--------------------------------------------------------------------------
    #surface: OffscreenSurface<"webgl", { xrCompatible: boolean }>;
    #fov_factor: number = 1.5;
    #overriden_near_plane?: number;
    #overridden_fovy?: number;
    #viewports: XRViewports = [];
    #context: XRContext;

    //--------------------------------------------------------------------------
    // WebXR API references
    #session: XRSession | null = null;
    #mode: XRSessionMode = "inline";
    #forceSingleView: boolean = false;
    #reference_space: XRReferenceSpace | null = null;
    #xr_viewports: XRViewport[] = [];
    #animationFrameRequestId: number = 0;

    //--------------------------------------------------------------------------
    /**
     * Test if the provided XR session mode is supported by this browser.
     * @param mode defines the XR session mode to test
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
    /**
     * The XRSession
     */
    get session(): XRSession | null {
        return this.#session;
    }

    //--------------------------------------------------------------------------
    /**
     * The XRSessionMode
     */
    get mode(): XRSessionMode {
        return this.#mode;
    }

    //--------------------------------------------------------------------------
    /**
     * The XRReferenceSpace used to get the pose of the XRView
     */
    get reference_space(): XRReferenceSpace | null {
        return this.#reference_space;
    }

    //--------------------------------------------------------------------------
    /**
     * True if exactly 2 XRView instances are available in the XRSession.
     */
    get is_stereo_vision(): boolean {
        return this.#xr_viewports.length === 2;
    }

    //--------------------------------------------------------------------------
    /**
     * Use to override the near plane provided by the projection matrix of the
     * xr views. Might be useful in the webxr emulator to see things close to
     * the eyes.
     */
    set overriden_near_plane(value: number | undefined) {
        this.#overriden_near_plane = value;
    }

    //--------------------------------------------------------------------------
    /**
     * Disable the application of the transform of the cameras origin
     */
    set cameras_origin_transform_enabled(value: boolean) {
        if (value) {
            this.#applyCamerasOrigin = this.#cameras_origin_apply;
            this.#unapplyCamerasOrigin = this.#cameras_origin_unapply;
        } else {
            this.#applyCamerasOrigin = () => {};
            this.#unapplyCamerasOrigin = () => {};
        }
    }

    //--------------------------------------------------------------------------
    constructor(resolution_scale: number = 1.0) {
        this.#surface = new OffscreenSurface({
            width: window.innerWidth, // Not sure
            height: window.innerHeight, // Really not sure
            context_constructor: XRContext,
            context_type: "webgl",
            context_options: { xrCompatible: true },
            resolution_scale,
        });
        this.#context = this.#surface.context as XRContext;
        this.#cameras_origin_apply = this.#applyCamerasOrigin;
        this.#cameras_origin_unapply = this.#unapplyCamerasOrigin;
    }

    //--------------------------------------------------------------------------
    /**
     * Release the XRSession and the rendering OffscreenSurface.
     */
    public async release(): Promise<void> {
        if (this.#session) {
            this.stop();
            await this.#session.end().catch(error => console.warn("Could not end XR session:", error));
        }

        if (this.#core) {
            for (const { livelink_viewport } of this.#viewports) {
                this.#core.removeViewport({ viewport: livelink_viewport });
            }
        }

        this.#surface.release();
    }

    //--------------------------------------------------------------------------
    /**
     * Get the fake alpha mode flag of the XRContext. If enabled: the alpha
     * channel is set highest intensity among rgb channels for all pixels with
     * all rgb intensities inferior than 0.1.
     */
    get fakeAlpha(): boolean {
        return this.#context.fake_alpha_enabled;
    }

    //--------------------------------------------------------------------------
    /**
     * Set the fake alpha mode flag of the XRContext. If enabled: the alpha
     * channel is set highest intensity among rgb channels for all pixels with
     * all rgb intensities inferior than 0.1.
     */
    set fakeAlpha(value: boolean) {
        this.#context.fake_alpha_enabled = value;
    }

    //--------------------------------------------------------------------------
    /**
     * Get fake alpha scale value of the XRContext used to remap fragment
     * opacity from [0..1] to [0..fakeAlphaScale] if inferior to 1.
     */
    get fakeAlphaScale(): number {
        return this.#context.fake_alpha_scale;
    }

    //--------------------------------------------------------------------------
    /**
     * Set fake alpha scale value of the XRContext used to remap fragment
     * opacity from [0..1] to [0..fakeAlphaScale] if inferior to 1.
     */
    set fakeAlphaScale(value: number) {
        if (value < 0 || value > 1) {
            throw new Error("Fake alpha scale must be between 0 and 1");
        }
        this.#context.fake_alpha_scale = value;
    }

    //--------------------------------------------------------------------------
    /**
     * Initialize the XRSession.
     * @param mode
     * @param options
     */
    public async initialize(
        mode: XRSessionMode,
        { xrSessionInit = {}, forceSingleView = false }: { xrSessionInit?: XRSessionInit; forceSingleView?: boolean },
    ): Promise<XRSession> {
        this.#mode = mode;
        this.#forceSingleView = forceSingleView;

        if (!WebXRHelper.isSessionSupported(mode)) {
            throw new Error(`WebXR "${mode}" not supported`);
        }

        if (this.#session) {
            console.warn("Releasing previous XR session");
            await this.release();
        }

        const spaceTypes: Array<XRReferenceSpaceType | undefined> = ["local-floor", "local"];
        let lastError: unknown;

        for (const spaceType of spaceTypes) {
            const sessionOptions: XRSessionInit = spaceType
                ? { ...xrSessionInit, requiredFeatures: [...(xrSessionInit.requiredFeatures || []), spaceType] }
                : xrSessionInit;

            try {
                this.#session = await navigator.xr!.requestSession(mode, sessionOptions);
                await this.updateRenderState();
                await this.setReferenceSpaceType(spaceType);
                break;
            } catch (error) {
                console.warn(
                    "Failed to request XR session",
                    { spaceType, requiredFeatures: sessionOptions.requiredFeatures },
                    error,
                );
                this.#session?.end();
                lastError = error;
            }
        }

        if (!this.#session) {
            throw lastError;
        }

        return this.#session;
    }

    //--------------------------------------------------------------------------
    /**
     * Configure the size and scale of the livelink viewports based on the XR views.
     * @param livelink
     * @param enableOverscan
     */
    public async configureViewports(livelink: Livelink, enableOverscan: boolean = false): Promise<void> {
        if (this.#core) {
            this.releaseLivelinkViewports();
        }

        this.#core = livelink;
        const xr_views = await this.#getXRViews();
        if (xr_views.length > 2) {
            console.error("WebXRHelper doesn't support more than 2 eyes yet");
            // Though it's not supported we still try to configure all viewports for each views and deal with the 2
            // first views cameras inside `this.#onXRFrame`.
        }
        this.#configureLivelinkViewports(xr_views);
        if (enableOverscan) {
            this.#configureOverscan(xr_views);
        }

        // AR session needs the FTL background to be pure black for the XRContext shader to simulate the background
        // transparency while the feature to send the background mask frame from FTL to the client is not implemented.
        const isAR = this.#mode === "immersive-ar";
        this.fakeAlpha = isAR;
        const dataJSON = isAR
            ? {
                  grid: false,
                  displayBackground: false,
              }
            : undefined;

        this.#core.addViewports({ viewports: this.#viewports.map(({ livelink_viewport }) => livelink_viewport) });
        for (const index in this.#viewports) {
            const { xr_view, xr_viewport, livelink_viewport } = this.#viewports[index];
            await this.#createViewportCamera({ index, xr_view, xr_viewport, viewport: livelink_viewport, dataJSON });
        }
    }

    //--------------------------------------------------------------------------
    /**
     * Obtains a single set of XR views from the XR session.
     * @returns {Promise<Readonly<XRView[]>>} Resolves with an array of XRView
     * of the XRSession obtained from the next XRFrame.
     */
    #getXRViews(): Promise<Readonly<Array<XRView>>> {
        const { promise, resolve, reject } = createPromiseWithResolvers<Readonly<Array<XRView>>>();

        let remaining_attempts = 200;
        const onFirstXRFrame = async (_: DOMHighResTimeStamp, frame: XRFrame): Promise<Array<XRView> | undefined> => {
            const xr_views = frame.getViewerPose(this.#reference_space!)?.views;
            if (!xr_views) {
                if (--remaining_attempts > 0) {
                    this.#session!.requestAnimationFrame(onFirstXRFrame);
                } else {
                    reject(new Error("Failed to get XR views."));
                }
                return;
            }

            if (this.#forceSingleView && xr_views.length > 1) {
                console.log("WebXRHelper: forcing single view");
                resolve(xr_views.slice(0, 1));
            } else {
                resolve(xr_views);
            }
        };

        this.#animationFrameRequestId = this.#session!.requestAnimationFrame(onFirstXRFrame);
        return promise;
    }

    //--------------------------------------------------------------------------
    /**
     * Compute the rendering OffscreenSurface & XRContext resolution scale and
     * the camera fovy.
     * @param xr_views
     */
    #configureOverscan(xr_views: Readonly<Array<XRView>>): void {
        // Commented out because change resolution_scale here crashes on iphone inside
        // `RemoteFrameProxy.#onFrameLayoutModified`
        // this.#surface.resolution_scale = this.#fov_factor;
        // this.#context.scale_factor = this.#surface.resolution_scale;
        this.#context.scale_factor = this.#fov_factor;

        const fovY = xr_views[0].projectionMatrix[5];
        const original_fov = 2 * Math.atan(1 / fovY);
        const new_fov = 2 * Math.atan(Math.tan(original_fov / 2) * this.#fov_factor);
        this.#overridden_fovy = new_fov * (180 / Math.PI);

        console.debug(
            `%cFOV: ${original_fov * (180 / Math.PI)} -> ${this.#overridden_fovy}, scale factor: ${this.#context.scale_factor}, resolution scale: ${this.#surface.resolution_scale}`,
            "color: orange; font-weight: bold; font-size: 1.5em",
        );
    }

    //--------------------------------------------------------------------------
    /**
     * Start the XRFrame animation loop.
     */
    public start(): void {
        this.#session!.requestAnimationFrame(this.#onXRFrame);
    }

    /**
     * Stop the XRFrame animation loop.
     */
    stop(): void {
        if (this.#animationFrameRequestId && this.#session) {
            this.#session.cancelAnimationFrame(this.#animationFrameRequestId);
        }
    }

    //--------------------------------------------------------------------------
    /**
     * Sets the reference space of the XR session
     * @param type - https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestReferenceSpace#type
     * @returns {Promise<XRReferenceSpace>} Resolves with the reference to the new reference space.
     */
    public async setReferenceSpaceType(type: XRReferenceSpaceType = "local"): Promise<XRReferenceSpace> {
        this.#reference_space = await this.#session!.requestReferenceSpace(type).catch(async error => {
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
        const session = this.#session!;
        const baseLayer = new XRWebGLLayer(session, this.#context.native, layer_init);
        await session.updateRenderState({ baseLayer });
        this.#context.frame_buffer = baseLayer.framebuffer;
        this.#surface.resize(baseLayer.framebufferWidth, baseLayer.framebufferHeight);
    }

    //--------------------------------------------------------------------------
    /**
     * Apply `this.cameras_origin` transformation on the eye(s) to shift the
     * eye(s) transform in the world.
     * @param cameras
     */
    #applyCamerasOrigin = (cameras: readonly Entity[]): void => {
        if (!this.cameras_origin) {
            return;
        }

        const origin_position = new Vector3().fromArray(this.cameras_origin.position);
        const origin_quat = new Quaternion().fromArray(this.cameras_origin.orientation);
        const origin_scale = new Vector3().fromArray(this.cameras_origin.scale);
        const reversed_origin_matrix = new Matrix4().compose(origin_position, origin_quat, origin_scale).invert();

        const origin_quat_conjugate = origin_quat.conjugate();

        for (const camera of cameras) {
            const { position, orientation } = camera.global_transform;
            const transformed_position = new Vector3().fromArray(position);
            transformed_position.applyMatrix4(reversed_origin_matrix);
            transformed_position.toArray(position);

            const quaternion = new Quaternion().fromArray(orientation);
            const transformed_orientation = new Quaternion().multiplyQuaternions(origin_quat_conjugate, quaternion);
            transformed_orientation.toArray(orientation);
        }
    };

    //--------------------------------------------------------------------------
    /**
     * Unapply this.cameras_origin transformation on the eye(s) to shift back
     * the eye(s) transform in the world. This is to find back the original
     * transform of the headset eyes to place the billboard. We must apply this
     * inverse transform because we want to use the frame_camera_transform and
     * not the XRView.transform to place the billboard.
     * @param views
     */
    #unapplyCamerasOrigin = (frame_camera_transforms: Pick<Transform, "position" | "orientation">[]): void => {
        if (!this.cameras_origin) {
            return;
        }

        const origin_position = new Vector3().fromArray(this.cameras_origin.position);
        const origin_quat = new Quaternion().fromArray(this.cameras_origin.orientation);
        const origin_scale = new Vector3().fromArray(this.cameras_origin.scale);
        const transform = new Matrix4().compose(origin_position, origin_quat, origin_scale);

        for (const frame_camera_transform of frame_camera_transforms) {
            const { position, orientation } = frame_camera_transform;
            const transformed_position = new Vector3().fromArray(position);
            transformed_position.applyMatrix4(transform);
            transformed_position.toArray(position);

            const quaternion = new Quaternion().fromArray(orientation);
            const transformed_orientation = new Quaternion().multiplyQuaternions(origin_quat, quaternion);
            transformed_orientation.toArray(orientation);
        }
    };

    //--------------------------------------------------------------------------
    /**
     * The XR session's animation frame loop.
     * @param time
     * @param frame
     */
    #onXRFrame = (_: DOMHighResTimeStamp, frame: XRFrame): void => {
        const session = this.#session!;
        const gl_layer = session.renderState.baseLayer!;
        const readonly_xr_views = frame.getViewerPose(this.#reference_space!)?.views;

        if (!readonly_xr_views) {
            session.requestAnimationFrame(this.#onXRFrame);
            return;
        }

        let xr_views: XRView[] = [...readonly_xr_views];
        let xr_viewports: XRViewport[] = [];
        xr_views.forEach(xr_view => {
            // TODO: getViewport might return undefined according to typing
            xr_viewports.push(gl_layer.getViewport(xr_view)!);
        });

        if (this.#forceSingleView) {
            xr_views = xr_views.splice(0, 1);
            xr_viewports = xr_viewports.splice(0, 1);
        }

        if (this.#xrViewportsHaveChanged(xr_viewports)) {
            // For now, we end the session if the viewports have changed
            // TODO: do we really want to waste time checkuing this...?
            console.error("XRViewports have changed, ending the XRSession");
            session.end();
        }

        this.#updateLiveLinkCameras(xr_views);
        this.#applyCamerasOrigin(this.#surface.cameras);

        const frame_camera_transforms: Pick<Transform, "position" | "orientation">[] = xr_viewports.map((_, index) => {
            const viewport = this.#surface.viewports[index];
            const { world_position, world_orientation } = viewport.camera_projection!;
            return {
                // Copy the transform array to prevent future mutations of the original arrays
                position: Array.from(world_position) as Vec3,
                orientation: Array.from(world_orientation) as Quat,
            } as Pick<Transform, "position" | "orientation">;
        });

        this.#unapplyCamerasOrigin(frame_camera_transforms);
        this.#context.drawXRFrame({ xr_views, xr_viewports, frame_camera_transforms });

        session.requestAnimationFrame(this.#onXRFrame);
    };

    //--------------------------------------------------------------------------
    /**
     * Update the cameras of the LiveLink instance.
     * @param xr_views
     */
    #updateLiveLinkCameras(xr_views: XRView[]): void {
        this.#surface.cameras.forEach((camera, index) => {
            const xr_view = xr_views[index];
            const { position: pos, orientation: quat } = xr_view.transform;
            const { livelink_viewport } = this.#viewports[index];
            const position = [pos.x, pos.y, pos.z] as Vec3;
            const orientation = [quat.x, quat.y, quat.z, quat.w] as Quat;

            camera.local_transform = { position, orientation };

            const new_perspective_lens = this.#computePerspectiveLens(
                xr_view.projectionMatrix,
                livelink_viewport.width,
                livelink_viewport.height,
            );
            const { aspectRatio, fovy, nearPlane, farPlane, offset } = new_perspective_lens;
            const has_changed =
                !camera.perspective_lens ||
                camera.perspective_lens.aspectRatio !== aspectRatio ||
                camera.perspective_lens.fovy !== fovy ||
                camera.perspective_lens.nearPlane !== nearPlane ||
                camera.perspective_lens.farPlane !== farPlane ||
                camera.perspective_lens.offset !== offset;
            if (has_changed) {
                // TODO: verify this change check is really necessary or if livelink handles it
                camera.perspective_lens = new_perspective_lens;
            }
        });
    }

    //--------------------------------------------------------------------------
    /**
     * Configure the livelink viewports based on the XR views.
     * @param xr_views
     */
    #configureLivelinkViewports(xr_views: readonly XRView[]): void {
        const gl_layer = this.#session!.renderState.baseLayer!;
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
            const viewport = new Viewport({
                core: this.#core!,
                rendering_surface: this.#surface,
                options: { rect },
            });

            this.#viewports.push({
                xr_view: xr_eye.view,
                xr_viewport: xrViewport,
                livelink_viewport: viewport,
            });
        }
    }

    //--------------------------------------------------------------------------
    /**
     *
     */
    releaseLivelinkViewports(): void {
        for (const viewport of this.#viewports) {
            this.#surface.removeViewport({ viewport: viewport.livelink_viewport });
        }
        this.#viewports.length = 0;
    }

    //--------------------------------------------------------------------------
    /**
     * Create the livelink camera with its lens & set the viewport camera projection.
     * @return Resolves with the created WebXRCamera instances
     */
    async #createViewportCamera({
        index,
        xr_view,
        xr_viewport,
        viewport,
        dataJSON,
    }: {
        index: number | string;
        xr_view: XRView;
        xr_viewport: XRViewport;
        viewport: Viewport;
        dataJSON?: RenderGraphDataObject;
    }): Promise<void> {
        const camera_entity = await this.#core!.scene.newEntity({
            name: `XR_camera_${xr_view.eye}_${index}`,
            components: {
                local_transform: {},
                perspective_lens: this.#computePerspectiveLens(
                    xr_view.projectionMatrix,
                    viewport.width,
                    viewport.height,
                ),
                camera: {
                    renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
                    dataJSON,
                },
                tags: {
                    value: [
                        `viewport_x = ${xr_viewport.x.toString()}`,
                        `viewport_y = ${xr_viewport.y.toString()}`,
                        `viewport_width = ${xr_viewport.width.toString()}`,
                        `viewport_height = ${xr_viewport.height.toString()}`,
                        `recommanded_scale = ${xr_view.recommendedViewportScale?.toString() || "?"}`,
                    ],
                },
            },
            options: { delete_on_client_disconnection: true, auto_broadcast: false },
        });

        viewport.camera_projection = new CameraProjection({ camera_entity, viewport });
        console.debug(`Created camera entity for ${xr_view.eye} eye:`, viewport);
    }

    //--------------------------------------------------------------------------
    /**
     * Extract the attributes of the perspective lens component from a
     * projection matrix and a viewport size.
     * @param projectionMatrix
     * @param viewportWidth
     * @param viewportHeight
     * @returns {object} { fovy, aspectRatio, nearPlane, farPlane }
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
        offset: [number, number];
    } {
        const aspectRatio = viewportWidth / viewportHeight;
        const fovy = this.#overridden_fovy ?? Math.atan(1 / projectionMatrix[5]) * (180 / Math.PI) * 2;
        let nearPlane = projectionMatrix[14] / (projectionMatrix[10] - 1);
        if (this.is_stereo_vision && this.cameras_origin && this.cameras_origin.scale[0] !== 1) {
            // if using stereo vision and the cameras origin has a scale then use it
            nearPlane *= 1 / this.cameras_origin.scale[0];
        }

        const farPlane = projectionMatrix[14] / (projectionMatrix[10] + 1);
        const offset = [projectionMatrix[8], projectionMatrix[9] * -1] as [number, number];
        return { fovy, aspectRatio, nearPlane: this.#overriden_near_plane || nearPlane, farPlane, offset };
    }

    //--------------------------------------------------------------------------
    /**
     * Check if the XRViewport instances passed as parameters are distinct from
     * the ones of the last XRFrame.
     * @param xr_views
     * @returns True if the XR viewports have changed
     */
    #xrViewportsHaveChanged(xr_viewports: XRViewport[]): boolean {
        if (this.#xr_viewports.length === 0) {
            return true;
        }
        return xr_viewports.some((xr_viewport, index) => {
            const previous_xr_viewport = this.#xr_viewports[index];
            if (!previous_xr_viewport) {
                return true;
            }
            return (
                previous_xr_viewport.width !== xr_viewport.width ||
                previous_xr_viewport.height !== xr_viewport.height ||
                previous_xr_viewport.x !== xr_viewport.x ||
                previous_xr_viewport.y !== xr_viewport.y
            );
        });
    }

    //--------------------------------------------------------------------------
    /**
     *
     */
    get resolution_scale(): number {
        return this.#surface.resolution_scale;
    }

    //--------------------------------------------------------------------------
    /**
     *
     */
    set resolution_scale(value: number) {
        this.#surface.resolution_scale = value;
    }
}

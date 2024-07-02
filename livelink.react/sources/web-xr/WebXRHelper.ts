//------------------------------------------------------------------------------
import { Camera, Livelink, OffscreenSurface, RelativeRect, Viewport } from "@3dverse/livelink";
import { XRContext } from "@3dverse/livelink-react/sources/web-xr/XRContext";

/**
 *
 */
export class WebXRCamera extends Camera {
    onCreate(): void {
        this.local_transform = {};
        this.perspective_lens = {};
        this.camera = {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: false, displayBackground: false },
        };
    }
}

/**
 *
 */
type XRViewports = Array<{
    xr_view: XRView;
    livelink_viewport: Viewport;
}>;

/**
 *
 */
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

/**
 *
 */
export class WebXRHelper {
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

    /**
     *
     */
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

    /**
     *
     */
    public async release(): Promise<void> {
        this.#surface?.release();
        if (this.#animationFrameRequestId) {
            this.session?.cancelAnimationFrame(this.#animationFrameRequestId);
        }
        return this.session?.end().catch(error => console.warn("Could not end XR session:", error));
    }

    /**
     *
     */
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

    /**
     *
     */
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

    /**
     *
     */
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

    /**
     *
     */
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
     * The XR session's animation frame loop.
     * @param time
     * @param frame
     */
    #onXRFrame = (_: DOMHighResTimeStamp, frame: XRFrame) => {
        const gl_layer = this.session!.renderState.baseLayer!;
        const xr_views = frame.getViewerPose(this.#reference_space!)?.views?.map(view => ({
            view,
            viewport: gl_layer.getViewport(view)!,
        }));

        if (!xr_views) {
            this.session!.requestAnimationFrame(this.#onXRFrame);
            return;
        }

        if (this.#xrViewportsHasChanged(xr_views)) {
            // For now, we end the session if the viewports have changed
            this.session!.end();
        }

        this.#updateLiveLinkCameras(xr_views);

        if (this.#context.meta_data) {
            this.#context.drawXRFrame({
                xr_views: xr_views.map(({ view, viewport }, index) => {
                    const currentViewport = this.#surface.viewports[index];
                    const { position, orientation } = this.#context.meta_data!.cameras.find(
                        c => c.camera.id === currentViewport.camera!.id,
                    )!;
                    return { view, viewport, frame_camera_transform: { position, orientation } };
                }),
            });
        }

        this.session!.requestAnimationFrame(this.#onXRFrame);
    };

    //--------------------------------------------------------------------------
    /**
     * Update the cameras of the LiveLink instance.
     */
    #updateLiveLinkCameras(xr_views: Array<{ view: XRView }>): void {
        const cameras = this.#surface!.cameras;

        cameras.forEach((camera, index) => {
            const { view } = xr_views[index];
            const { position, orientation } = view.transform;
            // Update the local_transform component
            camera!.local_transform = {
                position: [position.x, position.y, position.z],
                orientation: [orientation.x, orientation.y, orientation.z, orientation.w],
            };
        });
    }

    //--------------------------------------------------------------------------
    /**
     *
     */
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
    async createCameras(): Promise<void> {
        await Promise.all(
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
            }),
        );
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

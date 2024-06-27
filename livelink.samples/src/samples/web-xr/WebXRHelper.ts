//------------------------------------------------------------------------------
import { Camera, Livelink, Rect, Viewport } from "@3dverse/livelink";
import { OffscreenSurface } from "./OffscreenSurface";

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

type XRViewports = Array<{
    xr_view: XRView;
    livelink_viewport: Viewport;
}>;

/**
 *
 */
export class WebXRHelper {
    //--------------------------------------------------------------------------
    // References to livelink core
    #liveLink: Livelink | null = null;

    //--------------------------------------------------------------------------
    #surface: OffscreenSurface;

    //--------------------------------------------------------------------------
    // WebXR API references
    session: XRSession | null = null;
    private _reference_space: XRReferenceSpace | null = null;
    private _xr_viewports: XRViewport[] = [];
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
        });
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
    public configureViewports(livelink: Livelink): Promise<XRViewports> {
        this.#liveLink = livelink;
        if (!this.#liveLink) {
            throw new Error("Failed to configure XR session, no LiveLink instance was provided.");
        }

        let remaining_attempts = 200;
        const { promise, resolve, reject } = Promise.withResolvers<XRViewports>();
        const onFirstXRFrame = async (_: DOMHighResTimeStamp, frame: XRFrame) => {
            const xr_views = frame.getViewerPose(this._reference_space!)?.views;
            if (!xr_views) {
                if (--remaining_attempts > 0) {
                    this.session!.requestAnimationFrame(onFirstXRFrame);
                } else {
                    reject(new Error("Failed to get XR views."));
                }
                return;
            }

            const viewports = this.#createLivelinkViewports(xr_views);
            resolve(viewports);
        };

        this.#animationFrameRequestId = this.session!.requestAnimationFrame(onFirstXRFrame);
        return promise;
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
        this._reference_space = await this.session!.requestReferenceSpace(type).catch(async error => {
            console.error(`Failed to request XR reference space of type ${type}:`, error);
            throw error;
        });
        return this._reference_space;
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
        const context_webgl = this.#surface!.context!;
        const baseLayer = new XRWebGLLayer(session, context_webgl.native, layer_init);
        await session.updateRenderState({ baseLayer });
        context_webgl.frame_buffer = baseLayer.framebuffer;
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
        const xr_views = frame.getViewerPose(this._reference_space!)?.views?.map(view => ({
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

        this.#surface!.drawLastFrame(xr_views);
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
    #createLivelinkViewports(xr_views: readonly XRView[]): XRViewports {
        const gl_layer = this.session!.renderState.baseLayer!;
        const xr_eyes = xr_views.map(view => ({
            view,
            viewport: gl_layer.getViewport(view)!,
        }));
        const xr_viewports = xr_eyes.map(xr_eye => xr_eye.viewport);

        console.debug("XR views:", xr_views);
        console.debug("XR viewports:", xr_viewports);
        this._xr_viewports = xr_viewports;

        const are_xr_viewport_normalized = xr_eyes.every(({ viewport: v }) => {
            return v.x <= 1 && v.y <= 1 && v.width <= 1 && v.height <= 1;
        });

        // Create the viewports and attach them to the canvas
        const viewports: XRViewports = [];

        for (const xr_eye of xr_eyes) {
            const xrViewport = xr_eye.viewport;
            const rect: Rect = are_xr_viewport_normalized
                ? {
                      left: xrViewport.x,
                      top: xrViewport.y,
                      right: xrViewport.x + xrViewport.width,
                      bottom: xrViewport.y + xrViewport.height,
                      width: xrViewport.width,
                      height: xrViewport.height,
                  }
                : {
                      left: xrViewport.x / this.#surface!.width,
                      top: xrViewport.y / this.#surface!.height,
                      right: (xrViewport.x + xrViewport.width) / this.#surface!.width,
                      bottom: (xrViewport.y + xrViewport.height) / this.#surface!.height,
                      width: xrViewport.width / this.#surface!.width,
                      height: xrViewport.height / this.#surface!.height,
                  };
            console.debug(`Viewport for ${xr_eye.view.eye} eye:`, rect);
            const viewport = new Viewport(this.#liveLink!, this.#surface!, { rect });

            viewports.push({
                xr_view: xr_eye.view,
                livelink_viewport: viewport,
            });
        }

        this.#liveLink!.addViewports({ viewports: viewports.map(v => v.livelink_viewport) });
        return viewports;
    }

    //--------------------------------------------------------------------------
    async createCameras(viewports: XRViewports): Promise<void> {
        await Promise.all(
            viewports.map(async ({ xr_view, livelink_viewport }) => {
                const perspective_lens = this.#extractPerspectiveLens(
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
    #extractPerspectiveLens(
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
        // Extract FOV angle from the relevant element at row 2, column 2.
        const fovyRadians = 2 * Math.atan(1 / projectionMatrix[5]);
        // Convert FOV to degrees
        const fovy = fovyRadians * (180 / Math.PI);
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
        if (this._xr_viewports.length === 0) {
            return true;
        }
        return xr_views.some(({ viewport }, index) => {
            const xr_viewport = this._xr_viewports[index];
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

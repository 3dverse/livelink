//------------------------------------------------------------------------------
import { Camera, Viewport, ContextWebGL } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export class WebXRCamera extends Camera {
    onCreate(): void {
        this.local_transform = {};
        this.perspective_lens = {};
        this.camera = { renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392", dataJSON: { grid: false } };
    }
}

//------------------------------------------------------------------------------
export class WebXRHelper {
    //--------------------------------------------------------------------------
    // References to livelink core
    private _viewport: Viewport | null = null;
    private _context_webgl: ContextWebGL | null = null;

    //--------------------------------------------------------------------------
    // WebXR API references
    session: XRSession | null = null;
    private _reference_space: XRReferenceSpace | null = null;
    private _xr_viewports: XRViewport[] = [];

    //--------------------------------------------------------------------------
    // WebXRHelper logic
    private _is_first_frame: boolean = true;
    private _request_session_promise: Promise<void | XRSession>;

    //--------------------------------------------------------------------------
    // Debug HACK flag to invert eyes on a stereo vision device
    invert_eyes: boolean = false;

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
        // navigator.xr.supportsSession() throws an error if the session mode is
        // not supported.
        return typeof isSupported === "undefined" ? false : isSupported;
    }

    //--------------------------------------------------------------------------
    /**
     * Request an XR session: async operation, use initialize() to await the XR
     * session creation.
     * @param mode - XR session mode "immersive-ar" or "immersive-vr"
     * @param options - XR session options
     */
    constructor(mode: XRSessionMode, options: XRSessionInit = {}) {
        console.log(`WebXRHelper.constructor requesting ${mode} session with options:`, options);
        this._request_session_promise = navigator
            .xr!.requestSession(mode, options)
            .then(session => {
                this.session = session;
            })
            .catch(error => {
                console.error(
                    `WebXRHelper.constructor Unable to create ${mode} session due to the following error:`,
                    error,
                );
            });
    }

    //--------------------------------------------------------------------------
    /**
     * Release the XR session
     * @returns Resolves when the XR session is ended.
     */
    public async release(): Promise<void> {
        return this.session?.end().catch(error => console.warn("Could not end XR session:", error));
    }

    //--------------------------------------------------------------------------
    /**
     * Initializes an xr session. This must be initialized within a user action
     * before usage.
     * @returns Resolves when the XR session is created with
     * a valid render state and local reference space.
     */
    public async initialize(viewport: Viewport): Promise<void> {
        // TODO: handle multiple viewports which are baked by a rect of a common
        // canvas, e.g that use the same WebGLRenderingContext.
        this._viewport = viewport;
        this._context_webgl = viewport.getContext() as ContextWebGL;

        if (!(this._context_webgl instanceof ContextWebGL)) {
            throw new Error("Viewport should be initialized with a webgl context");
        }

        await this._request_session_promise;
        if (!this.session) {
            throw new Error("Failed to initialize XR session, no session was created.");
        }
        await this.updateRenderState();
        await this.setReferenceSpaceType("local");
        this._startXRAnimationFrameLoop();
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
        const context_webgl = this._context_webgl!;
        const baseLayer = new XRWebGLLayer(session, context_webgl.native, layer_init);
        await session.updateRenderState({ baseLayer });
        context_webgl.frame_buffer = baseLayer.framebuffer;
    }

    //--------------------------------------------------------------------------
    /**
     * Enables the XR session's animation frame loop.
     */
    private _startXRAnimationFrameLoop(): void {
        // Ask the webgl canvas to delegate the frame consuming
        // TODO: this is not configurable yet
        // this._viewport_context!.is_frame_consuming_delegated = true;
        this.session!.requestAnimationFrame(this._onXRFrame);
    }

    //--------------------------------------------------------------------------
    /**
     * The XR session's animation frame loop.
     * @param time
     * @param frame
     */
    private _onXRFrame = (_: DOMHighResTimeStamp, frame: XRFrame) => {
        const xr_views = frame.getViewerPose(this._reference_space!)?.views;
        if (!xr_views) {
            this.session!.requestAnimationFrame(this._onXRFrame);
            return;
        }

        // TODO: WebXR of the legacy 3dverse-sdk checks the viewports has changed
        // on each XRFrame. I'm not sure it's necessary, though it might if you
        // think about the drop down menu on Meta Quest (2D-stereo, 3D-stereo, ...).
        this._updateLiveLinkViewports(xr_views);

        if (this._is_first_frame) {
            // TODO: May be this is a bit too much hidden. Indeed the webgl canvas
            // starts to consume frames once the livelink core is resumed from here,
            // and it's done here because we have the viewports at this right moment.
            // this._liveLink!.resume();
            this._is_first_frame = false;
        } else {
            // TODO: recall requestAnimationFrame before or after updating the cameras?
            this._updateLiveLinkCameras(xr_views);
        }

        // In the "WebXR API Emulator" drawing from XRSession.requestAnimationFrame
        // is not mandatory. But it is mandatory on the Meta Quest headset, if it's
        // not done this way you get an error a no rendering output.
        this._viewport!.drawLastFrame();
        // if (!this._viewport!.drawLastFrame()) {
        //     // This is where the "WebXR API Emulator" may flick if there is no
        //     // frame to draw. But it does not happen in the Meta Quest headset.
        //     // Please see the "Frame buffer auto-clear" section in ./README.md for more
        //     // details.
        //     console.debug("no frame to draw!!");
        // }

        // We cannot await the next decoded frame to call XRSession.requestAnimationFrame,
        // otherwise the XRWebGLLayer frame buffer is cleared and we draw nothing, so
        // it flicks in the emulator too.
        this.session!.requestAnimationFrame(this._onXRFrame);
    };

    //--------------------------------------------------------------------------
    /**
     * Update the cameras of the LiveLink instance.
     */
    // TODO: Only the first XR view is supported so far. Implement multiple
    // views support.
    private _updateLiveLinkCameras(xr_views: readonly XRView[]) {
        // const viewports = this._viewport!.viewports;
        const viewports = [this._viewport!];
        const cameras = viewports.map(viewport => viewport.camera);

        if (this.invert_eyes && cameras.length === 2) {
            // DEBUG HACK: Invert eyes on stereo vision device
            // console.debug("Meta Quest temporary HACK because eyes are inverted");
            const right_eye = cameras[1];
            cameras[1] = cameras[0];
            cameras[0] = right_eye;
        }

        cameras.forEach((camera, index) => {
            const xr_view = xr_views[index];
            const { position, orientation } = xr_view.transform;
            // Update the local_transform component
            camera!.local_transform = {
                position: [position.x, position.y, position.z],
                orientation: [orientation.x, orientation.y, orientation.z, orientation.w],
            };
        });
    }

    //--------------------------------------------------------------------------
    /**
     * Update the viewports of the LiveLink instance.
     * @returns Resolves when the livelink viewport have been updated.
     */
    // TODO: Only the first XR viewport is supported so far. Implement multiple
    // viewports support.
    private _updateLiveLinkViewports(xr_views: readonly XRView[]) {
        const gl_layer = this.session!.renderState.baseLayer!;
        const xr_eyes = xr_views.map(view => ({
            view,
            viewport: gl_layer.getViewport(view)!,
        }));
        const xr_viewports = xr_eyes.map(xr_eye => xr_eye.viewport);

        // Check if the viewports must be updated
        if (!this._xrViewportsHasChanged(xr_viewports)) {
            return;
        }
        console.debug("XR views:", xr_views);
        console.debug(
            "XR viewports:",
            xr_eyes.map(v => v.viewport),
        );
        this._xr_viewports = xr_viewports;

        // Extract the rects of the XRViewports
        const viewport_rects = this._extractXRViewportRects([xr_viewports[0]]);

        // Set full canvas size to the maximum of the XRViewports
        const eyesWidth = viewport_rects.reduce((acc, viewport) => Math.max(acc, viewport.x + viewport.width), 0);
        const eyesHeight = viewport_rects.reduce((acc, viewport) => Math.max(acc, viewport.y + viewport.height), 0);
        console.debug("Resize canvas to ", eyesWidth, eyesHeight);
        this._viewport!.setSize(eyesWidth, eyesHeight);

        // Update the viewport camera perspective lens
        const xr_eye = xr_eyes[0];
        const rect = viewport_rects[0];
        const perspective_lens = this._extractPerspectiveLens(xr_eye.view.projectionMatrix, rect.width, rect.height);
        this._viewport!.camera!.perspective_lens = perspective_lens;

        // Create the viewports and attach them to the canvas
        // const canvas = this._viewport!;
        // const viewports: Array<Viewport> = [];
        // for (let i = 0; i < xr_eyes.length; i++) {
        //     const xr_eye = xr_eyes[i];
        //     const rect = viewport_rects[i];

        //     // Create the camera enttity
        //     const perspective_lens = this._extractPerspectiveLens(xr_eye.view.projectionMatrix, rect.width, rect.height);
        //     const camera = await this._liveLink!.newEntity(WebXRCamera, `XR_camera_${xr_eye.view.eye}`);
        //     camera.perspective_lens = perspective_lens;

        //     // Create the viewport
        //     const viewport = this._createViewport(rect, camera);
        //     console.debug(`Viewport for ${xr_eye.view.eye} eye:`, xr_eye.viewport);
        //     console.debug(`3dverse Viewport for ${xr_eye.view.eye} eye:`, viewport);
        //     viewports.push(viewport);
        // }
        // canvas.attachViewports(viewports);
    }

    //--------------------------------------------------------------------------
    /**
     * Create a livelink Viewport from the a WebXRCamera an XRViewport's rect
     * normalized on the remote canvas size.
     * @param xr_viewport_rect the XR viewport rect
     * @param camera The livelink webxr camera
     * @returns The livelink viewport instance
     */
    // private _createViewport(xr_viewport_rect: any, camera: WebXRCamera): Viewport {
    //     const canvas = this._viewport!.surface!.canvas;
    //     const remoteWidth = canvas.remote_canvas_size[0];
    //     const remoteHeigth = canvas.remote_canvas_size[1];
    //     const viewport_rect = {
    //         left: xr_viewport_rect.x / remoteWidth,
    //         top: xr_viewport_rect.y / remoteHeigth,
    //         width: xr_viewport_rect.width / remoteWidth,
    //         height: xr_viewport_rect.height / remoteHeigth,
    //     };
    //     return new Viewport({ camera, ...viewport_rect });
    // }

    //--------------------------------------------------------------------------
    /**
     * Extract the attributes of the perspective lens component from a
     * projection matrix and a viewport size.
     * @param projectionMatrix
     * @param viewportWidth
     * @param viewportHeight
     */
    _extractPerspectiveLens(
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
     * @param xr_viewports
     */
    private _xrViewportsHasChanged(xr_viewports: XRViewport[]): boolean {
        if (this._xr_viewports.length === 0) {
            return true;
        }
        return xr_viewports.some((viewport, index) => {
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

    //--------------------------------------------------------------------------
    /**
     * Extract the rects of the XRViewport instances
     * @param xr_viewports
     */
    private _extractXRViewportRects(xr_viewports: XRViewport[]): {
        x: number;
        y: number;
        width: number;
        height: number;
    }[] {
        // Check if the viewport rects are normalized
        const viewport_is_normalized = xr_viewports.map(v => {
            return v.x <= 1 && v.y <= 1 && v.width <= 1 && v.height <= 1;
        });
        const are_xr_viewport_normalized = viewport_is_normalized.find(v => !v);
        let viewport_rects;
        if (are_xr_viewport_normalized) {
            // XRViewport has a normalized rect between [O.O, 1.0] when running the
            // "WebXR API Emulator" extension, so use the window size.
            console.warn(
                "The XR sessions viewports have normalized rects so resize those according to the window size.",
            );
            const w = window.innerWidth;
            const h = window.innerHeight;
            viewport_rects = xr_viewports.map(viewport => ({
                x: Math.floor(viewport.x * w),
                y: Math.floor(viewport.y * h),
                width: Math.floor(viewport.width * w),
                height: Math.floor(viewport.height * h),
            }));
        } else {
            viewport_rects = xr_viewports.map(viewport => {
                const { x, y, width, height } = viewport;
                return { x, y, width, height };
            });
        }

        // Check if the viewports are too small for the 3dverse renderer
        viewport_rects.forEach(viewport => {
            if (viewport.width * viewport.height < 640 * 480) {
                console.warn("Viewport is too small:", viewport);
                console.warn("=> resize it to 640x480");
                viewport.width = viewport.width < viewport.height ? 480 : 640;
                viewport.height = viewport.width < viewport.height ? 640 : 480;
            }
        });

        return viewport_rects;
    }
}

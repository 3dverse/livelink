//------------------------------------------------------------------------------
import { createPromiseWithResolvers } from "./utils/createPromiseWithResolvers";

//------------------------------------------------------------------------------
/**
 * Manages WebXR session lifecycle following Single Responsibility Principle.
 * Responsible for:
 * - Session initialization
 * - Reference space management
 * - Session mode handling
 * - Session state
 *
 * @experimental
 */
export class LXRSession {
    /**
     * The active XRSession
     */
    #xr_session?: XRSession;

    /**
     * The XR session mode (inline, immersive-vr, immersive-ar)
     */
    #xr_mode: XRSessionMode = "inline";

    /**
     * The XRReferenceSpace used to get the pose of the XRView
     */
    #xr_reference_space?: XRReferenceSpace;

    /**
     * Whether to force single view rendering (mono instead of stereo).
     * Useful on iPhone with Variant Launch App which provides 2 views but only first one is useful.
     */
    #force_single_view: boolean = false;

    /**
     * Test if the provided XR session mode is supported by this browser.
     * @param mode defines the XR session mode to test
     * @returns Resolves with boolean indicating if the provided session mode is supported.
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
     * The active XRSession
     */
    get native(): XRSession | undefined {
        return this.#xr_session;
    }

    /**
     * The XRSessionMode
     */
    get xr_mode(): XRSessionMode {
        return this.#xr_mode;
    }

    /**
     * Whether the session is immersive AR
     */
    get is_ar(): boolean {
        return this.#xr_mode === "immersive-ar";
    }

    /**
     * Whether the session is immersive VR
     */
    get is_vr(): boolean {
        return this.#xr_mode === "immersive-vr";
    }

    /**
     * The XRReferenceSpace used to get the pose of the XRView
     */
    get reference_space(): XRReferenceSpace | undefined {
        return this.#xr_reference_space;
    }

    /**
     * Whether to force single view rendering (mono instead of stereo)
     */
    get force_single_view(): boolean {
        return this.#force_single_view;
    }

    /**
     * Helper method to check abort signal and throw standardized abort error if aborted.
     */
    #throwIfAborted(signal: AbortSignal | undefined, operation: string = "initialization"): void {
        if (signal?.aborted) {
            throw new DOMException(`XRSessionManager ${operation} aborted`, "AbortError");
        }
    }

    /**
     * Initialize the XRSession.
     * @param mode The XR session mode (inline, immersive-vr, immersive-ar)
     * @param xr_session_init Optional XRSessionInit parameters
     * @param force_single_view Whether to force single view rendering (mono instead of stereo)
     * @param signal Optional AbortSignal to cancel initialization
     * @returns Promise resolving to the created XRSession
     */
    public async initialize({
        mode,
        xr_session_init = {},
        force_single_view = false,
        signal,
    }: {
        mode: XRSessionMode;
        xr_session_init?: XRSessionInit;
        force_single_view?: boolean;
        signal?: AbortSignal;
    }): Promise<XRSession> {
        this.#xr_mode = mode;
        this.#force_single_view = force_single_view;

        if (!(await LXRSession.isSessionSupported(mode))) {
            throw new Error(`WebXR "${mode}" not supported`);
        }

        this.#throwIfAborted(signal);

        if (this.#xr_session) {
            console.warn("Releasing previous XR session");
            await this.release();
        }

        this.#throwIfAborted(signal);

        const spaceTypes: Array<XRReferenceSpaceType> = ["local-floor", "local"];
        let lastError: unknown;

        for (const spaceType of spaceTypes) {
            const sessionOptions: XRSessionInit = {
                ...xr_session_init,
                requiredFeatures: [...(xr_session_init.requiredFeatures || []), spaceType],
            };

            try {
                this.#xr_session = await navigator.xr!.requestSession(mode, sessionOptions);
                this.#throwIfAborted(signal);

                await this.setReferenceSpaceType(spaceType);
                this.#throwIfAborted(signal);
                break;
            } catch (error) {
                console.warn(
                    "Failed to request XR session",
                    { spaceType, requiredFeatures: sessionOptions.requiredFeatures },
                    error,
                );
                await this.release();
                lastError = error;
            }
        }

        if (!this.#xr_session) {
            throw lastError;
        }

        return this.#xr_session;
    }

    /**
     * Sets the reference space of the XR session
     * @param type Reference space type
     * @returns Promise resolving to the new reference space
     */
    public async setReferenceSpaceType(type: XRReferenceSpaceType = "local"): Promise<XRReferenceSpace> {
        if (!this.#xr_session) {
            throw new Error("Cannot set reference space: no active session");
        }

        this.#xr_reference_space = await this.#xr_session.requestReferenceSpace(type).catch(async error => {
            console.error(`Failed to request XR reference space of type ${type}:`, error);
            throw error;
        });
        return this.#xr_reference_space;
    }

    /**
     * Obtains a single set of XR views from the XR session.
     * @returns Promise resolving to an array of XRView
     */
    public async getXRViews(): Promise<Readonly<Array<XRView>>> {
        if (!this.#xr_session || !this.#xr_reference_space) {
            throw new Error("Cannot get XR views: session or reference space not initialized");
        }

        const { promise, resolve, reject } = createPromiseWithResolvers<Readonly<Array<XRView>>>();

        let remaining_attempts = 200;
        const onFirstXRFrame = async (_: DOMHighResTimeStamp, frame: XRFrame): Promise<Array<XRView> | undefined> => {
            const xr_views = frame.getViewerPose(this.#xr_reference_space!)?.views;
            if (!xr_views) {
                if (--remaining_attempts > 0) {
                    this.#xr_session!.requestAnimationFrame(onFirstXRFrame);
                } else {
                    reject(new Error("Failed to get XR views."));
                }
                return;
            }

            if (this.#force_single_view && xr_views.length > 1) {
                console.log("XRSessionManager: forcing single view");
                resolve(xr_views.slice(0, 1));
            } else {
                resolve(xr_views);
            }
        };
        this.#xr_session.requestAnimationFrame(onFirstXRFrame);
        return promise;
    }

    /**
     * End the XRSession.
     * @returns Promise resolving when session is ended
     */
    public async release(): Promise<void> {
        if (this.#xr_session) {
            await this.#xr_session.end().catch(error => console.warn("Could not end XR session:", error));
            this.#xr_session = undefined;
            this.#xr_reference_space = undefined;
        }
    }
}

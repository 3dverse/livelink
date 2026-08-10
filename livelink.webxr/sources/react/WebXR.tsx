//------------------------------------------------------------------------------
import React, {
    forwardRef,
    type JSX,
    type PropsWithChildren,
    Ref,
    useContext,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

//------------------------------------------------------------------------------
import type { Transform, Viewport } from "@3dverse/livelink";
import { LivelinkContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { XRLivelink } from "../XRLivelink";
import type { SessionEndEvent } from "../LXREvents";
import { WebXRVirtualViewports } from "./WebXRVirtualViewports";
import { WebXRContext } from "./WebXRContext";

//------------------------------------------------------------------------------
/**
 * Component providing WebXR experience management.
 *
 * @category Components
 */
export const WebXR = forwardRef(function (
    {
        children,
        mode,
        requiredFeatures = [],
        optionalFeatures = [],
        forceSingleView,
        originTransform,
        preserveInitialOrientation = false,
        latencyCompensation = true,
        overscan = false,
        fakeAlpha,
        scale = 1.0,
        domOverlayRoot,
        onSessionEnd,
        onError,
        renderViewport,
    }: PropsWithChildren<{
        /**
         * XR session mode. See {@link https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession#mode XRSessionMode}.
         */
        mode: XRSessionMode;

        /**
         * Required features for XR session. See {@link https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession#options XRSessionInit.requiredFeatures}.
         */
        requiredFeatures?: string[];

        /**
         * Optional features for XR session. See {@link https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession#options XRSessionInit.optionalFeatures}.
         */
        optionalFeatures?: string[];

        /**
         * Forces single view mode on devices supporting stereo rendering.
         */
        forceSingleView?: boolean;

        /**
         * Transform for XR origin (initial position, orientation, or scale).
         */
        originTransform?: Partial<Transform>;

        /**
         * Whether to preserve the device's physical orientation (pitch/roll) at session start in tracking normalization.
         *
         * At session start, the device orientation is captured:
         * - **Yaw** (horizontal direction): Always starts at 0 (no absolute north reference)
         * - **Pitch** (tilt up/down): Captured from device inclination relative to gravity
         * - **Roll** (tilt sideways): Captured from device rotation relative to gravity
         *
         * - **false (default)**: Pitch and roll are zeroed out. Virtual world orientation is level and fixed,
         *   determined solely by `originTransform`. The virtual floor stays horizontal regardless of how you held
         *   the device when starting the session.
         * - **true**: Pitch and roll are preserved. If you started the session with your phone tilted 30° upward,
         *   the virtual coordinate system adapts to that tilt.
         *
         * Most use cases want false to ensure consistent, level virtual world orientation.
         */
        preserveInitialOrientation?: boolean;

        /**
         * Enables latency compensation (draws scene on plane to reduce perceived latency). Enabled by default.
         */
        latencyCompensation?: boolean;

        /**
         * Enables overscan for latency compensation (increases FOV to reduce edge artifacts).
         */
        overscan?: boolean;

        /**
         * Enables/disables fake alpha for AR (simulates transparency with black background). Default: true for "immersive-ar".
         */
        fakeAlpha?: boolean;

        /**
         * Resolution scale factor for XR session.
         */
        scale?: number;

        /**
         * Custom DOM overlay root element.
         */
        domOverlayRoot?: Element;

        /**
         * Callback invoked when the XR session ends on its own — headset system menu, back gesture,
         * doff timeout, or a UA-side failure.
         *
         * Ends caused by this component releasing the session (unmount, or a switch from AR to VR)
         * are not reported, so this can be wired unconditionally to leaving the XR mode.
         */
        onSessionEnd?: (event: XRSessionEvent) => void;

        /**
         * Callback invoked when the XR session could not be started — permission dismissed,
         * `requestSession` rejected, reference space unavailable, no XR view obtained.
         *
         * There is no session and no rendering when this fires: the consumer that decided to enter
         * XR is the only one that can undo that decision, so it should reset its XR mode here.
         */
        onError?: (error: unknown) => void;

        /**
         * Render function for each WebXR viewport. Returns JSX wrapped in ViewportContext.Provider.
         */
        renderViewport?: (viewport: Viewport, index: number) => React.ReactNode;
    }>,
    ref: Ref<{ livelinkXR: XRLivelink | undefined }>,
): JSX.Element {
    //--------------------------------------------------------------------------
    // Ref
    const cleanupPromiseRef = useRef<Promise<void> | null>(null);

    //--------------------------------------------------------------------------
    // Held in refs so that a caller passing inline closures neither re-runs the session lifecycle
    // effect below on every render nor gets called through a stale closure.
    const onSessionEndRef = useRef(onSessionEnd);
    const onErrorRef = useRef(onError);
    onSessionEndRef.current = onSessionEnd;
    onErrorRef.current = onError;

    //--------------------------------------------------------------------------
    // State
    const [xrLivelink, setXRLivelink] = useState<XRLivelink | null>(null);
    const [domOverlayRootElement, setDomOverlayRootElement] = useState<Element | undefined>(domOverlayRoot);

    //--------------------------------------------------------------------------
    // Context
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    // Memoize context value to avoid unnecessary re-renders of consumers
    const contextValue = useMemo(() => ({ xrLivelink }), [xrLivelink]);

    //--------------------------------------------------------------------------
    useImperativeHandle(ref, () => ({ livelinkXR: xrLivelink ?? undefined }), [xrLivelink]);

    //--------------------------------------------------------------------------
    // Manage xrLivelink lifecycle: create when instance available, release on cleanup
    useLayoutEffect(() => {
        if (!instance || !domOverlayRootElement) {
            return;
        }

        // Generate a unique ID for this effect to correlate logs related to the same lifecycle
        const effectId = Math.random().toString(36).substring(2, 9);

        // Abort controller to avoid side effects when the component is unmounted.
        // Abort has to be handled in async functions to prevent state updates after the component is unmounted.
        const abort_controller = new AbortController();
        const { signal } = abort_controller;

        // Associate the XRLivelink instance with the Livelink instance from context
        const xr = new XRLivelink(instance);

        // Subscribed before initialization starts: a session the user backs out of while the
        // viewports are still being configured ends without ever having been reported otherwise.
        // XRLivelink suppresses the ends it causes itself, so this fires only for the ones the
        // consumer has to react to.
        const onXRSessionEnd = (event: SessionEndEvent): void => {
            onSessionEndRef.current?.(event.xr_session_event);
        };
        xr.addEventListener("on-session-end", onXRSessionEnd);

        const reentrantAsyncInit = async (): Promise<void> => {
            // Wait for any pending cleanup of the previous instance to complete before initializing
            if (cleanupPromiseRef.current) {
                await cleanupPromiseRef.current;
            }
            if (signal.aborted) {
                throw new DOMException(`[${effectId}] XRLivelink start up aborted before initialization`, "AbortError");
            }

            console.debug(`[${effectId}] XRLivelink start up`, { scale, overscan, fakeAlpha });

            // Initialize XRLivelink and start XR session
            await xr.initialize({
                mode,
                xr_session_init: {
                    requiredFeatures,
                    optionalFeatures: ["dom-overlay", ...optionalFeatures],
                    domOverlay: { root: domOverlayRootElement },
                },
                force_single_view: forceSingleView,
                origin_transform: originTransform,
                preserve_initial_orientation: preserveInitialOrientation,
                signal,
            });

            console.debug(`[${effectId}] XRLivelink configuring viewports & start XRFrame loop`);
            xr.start();

            console.debug(`[${effectId}] XRLivelink started`);
            setXRLivelink(xr);
        };

        // Start the async initialization and handle any errors (abort or not) to avoid unhandled promise rejections
        reentrantAsyncInit().catch(error => {
            if (error?.name === "AbortError") {
                console.debug(`[${effectId}] XRLivelink start up aborted`);
                return;
            }

            // Nothing was rendered and no session is live, but the consumer already committed to an
            // XR mode to get here. Without this it stays committed, with no session, no 3D view and
            // — since the exit affordance usually depends on a live session — no way back out.
            console.error(`[${effectId}] Failed to start up XRLivelink`, error);
            onErrorRef.current?.(error);
        });

        return (): void => {
            console.debug(`[${effectId}] Releasing XRLivelink`);
            xr.removeEventListener("on-session-end", onXRSessionEnd);
            abort_controller.abort();
            cleanupPromiseRef.current = xr.release().finally(() => {
                cleanupPromiseRef.current = null;
                console.debug(`[${effectId}] XRLivelink released`);
            });
        };
        // `fakeAlpha` is deliberately absent: it is applied by its own effect below, and listing it
        // here would tear the XR session down and restart it just to toggle transparency.
    }, [
        instance,
        mode,
        requiredFeatures.join("-"),
        optionalFeatures.join("-"),
        forceSingleView,
        domOverlayRootElement,
    ]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (xrLivelink) {
            xrLivelink.resolution_scale = scale;
        }
    }, [xrLivelink, scale]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (xrLivelink) {
            xrLivelink.enable_latency_compensation = latencyCompensation;
        }
    }, [xrLivelink, latencyCompensation]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (xrLivelink) {
            xrLivelink.enable_overscan = overscan;
        }
    }, [xrLivelink, overscan]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (xrLivelink && fakeAlpha !== undefined) {
            xrLivelink.enable_fake_alpha = fakeAlpha;
        }
    }, [xrLivelink, fakeAlpha]);

    //--------------------------------------------------------------------------
    return (
        <WebXRContext.Provider value={contextValue}>
            {!domOverlayRoot ? (
                <div
                    data-role="webxr-dom-overlay"
                    ref={ref => setDomOverlayRootElement(ref || undefined)}
                    style={{
                        position: "fixed",
                        width: "100%",
                        height: "100%",
                        top: 0,
                        left: 0,
                    }}
                >
                    {children}
                </div>
            ) : (
                <>{children}</>
            )}
            <WebXRVirtualViewports
                xrLivelink={xrLivelink}
                renderViewport={renderViewport}
                viewports={xrLivelink?.viewports || []}
                domOverlayRoot={domOverlayRootElement}
            />
        </WebXRContext.Provider>
    );
});

//------------------------------------------------------------------------------
import React, {
    JSX,
    type PropsWithChildren,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

//------------------------------------------------------------------------------
import { LivelinkContext } from "@3dverse/livelink-react";
import { WebXRHelper } from "../WebXRHelper";

//------------------------------------------------------------------------------
/**
 * Context that provides utilities for WebXR.
 *
 * @category Contexts
 */
export const WebXRContext = createContext<{ webXRHelper: WebXRHelper | null; xrSession: XRSession | null }>({
    webXRHelper: null,
    xrSession: null,
});

//------------------------------------------------------------------------------
/**
 * A component that provides a WebXR session
 *
 * @category Components
 */
export function WebXR({
    children,
    mode,
    requiredFeatures = [],
    optionalFeatures = [],
    forceSingleView,
    latencyCompensation = true,
    overscan = false,
    fakeAlpha,
    scale = 1.0,
    domOverlayRoot,
    onSessionEnd,
}: PropsWithChildren<{
    /**
     * The mode of the XR session. See {@link https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession#mode XRSessionMode} for more details.
     */
    mode: XRSessionMode;

    /**
     * The required features for the XR session. See {@link https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession#options XRSessionInit.requiredFeatures} for more details.
     */
    requiredFeatures?: string[];

    /**
     * The optional features for the XR session. See {@link https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession#options XRSessionInit.optionalFeatures} for more details.
     */
    optionalFeatures?: string[];

    /**
     * Forces single view mode, even on devices that support stereo rendering.
     */
    forceSingleView?: boolean;

    /**
     * Enables latency compensation mode to draw the scene on a plane to reduce perceived latency.
     * Enabled by default.
     */
    latencyCompensation?: boolean;

    /**
     * Enables overscan for latency compensation mode, increasing the field of view to reduce edge artifacts.
     */
    overscan?: boolean;

    /**
     * Enables or disable fake alpha mode for AR sessions, which simulates transparency with black background.
     * Enabled by default for "immersive-ar" mode.
     */
    fakeAlpha?: boolean;

    /**
     * The resolution scale factor to apply to the XR session.
     */
    scale?: number;

    /**
     * Specifies a custom DOM overlay root element.
     */
    domOverlayRoot?: Element;

    /**
     * Callback invoked when the XR session ends.
     */
    onSessionEnd?: () => void;
}>): JSX.Element {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement>(null);
    const webXRHelper = useMemo(
        () => new WebXRHelper(scale),
        [mode, requiredFeatures.join("-"), optionalFeatures.join("-"), forceSingleView, domOverlayRoot],
    );
    const initializationPromiseRef = useRef<Promise<void> | null>(null);
    const [xrSession, setXrSession] = useState<XRSession | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        webXRHelper.resolution_scale = scale;
    }, [webXRHelper, scale]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        webXRHelper.enable_latency_compensation = latencyCompensation;
    }, [webXRHelper, latencyCompensation]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        webXRHelper.enable_overscan = overscan;
    }, [webXRHelper, overscan]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!xrSession || !onSessionEnd) {
            return;
        }

        xrSession.addEventListener("end", onSessionEnd);

        return (): void => {
            xrSession.removeEventListener("end", onSessionEnd);
        };
    }, [xrSession, onSessionEnd]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        const rootDomOverlay = domOverlayRoot || containerRef.current;
        if (!rootDomOverlay || !instance) {
            return;
        }

        // Initialize the WebXR session is kept in a ref to avoid
        // re-initializing it on every render, especially when on strict mode.
        if (!initializationPromiseRef.current) {
            console.debug("---- Initializing WebXR", { scale, overscan, fakeAlpha });

            initializationPromiseRef.current = webXRHelper
                .initialize(mode, {
                    xrSessionInit: {
                        requiredFeatures,
                        optionalFeatures: ["dom-overlay", ...optionalFeatures],
                        domOverlay: { root: rootDomOverlay },
                    },
                    forceSingleView,
                })
                .then(session => {
                    setXrSession(session);
                    console.debug("---- Setting XR viewports");
                    return webXRHelper.configureViewports({
                        livelink: instance,
                        enable_fake_alpha: fakeAlpha,
                    });
                })
                .then(() => {
                    console.debug("---- WebXR initialized");
                    webXRHelper.start();
                    initializationPromiseRef.current = null;
                });
        }

        return (): void => {
            // This function might be called before the initialization promise
            // is resolved in strict mode. But this is not a problem since the
            // webXRHelper cannot release anything before the initialization is done.
            console.debug("---- Releasing WebXR");
            webXRHelper.release();
            setXrSession(null);
        };
    }, [webXRHelper, instance]);

    //--------------------------------------------------------------------------
    return (
        <WebXRContext.Provider value={{ webXRHelper, xrSession }}>
            {!domOverlayRoot ? (
                <div data-role="webxr-dom-overlay" ref={containerRef}>
                    {children}
                </div>
            ) : (
                <>{children}</>
            )}
        </WebXRContext.Provider>
    );
}

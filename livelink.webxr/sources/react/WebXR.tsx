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
 * @param params
 * @param params.mode - The mode of the XR session.
 * @param params.resolution_scale - The resolution scale of the XR session.
 * @param params.onSessionEnd - The callback to call when the XR session ends.
 * @param params.forceSingleView - Whether to force single view mode.
 * @param params.requiredFeatures - The required features for the XR session.
 * @param params.optionalFeatures - The optional features for the XR session.
 * @param params.domOverlayRoot - Specifies a custom DOM overlay root element.
 *
 * @category Components
 */
export function WebXR({
    children,
    mode,
    resolutionScale = 1.0,
    requiredFeatures = [],
    optionalFeatures = [],
    forceSingleView,
    overscanFovFactor,
    enableOverscanSurfaceScale,
    domOverlayRoot,
    onSessionEnd,
}: PropsWithChildren<{
    mode: XRSessionMode;
    resolutionScale?: number;
    requiredFeatures?: string[];
    optionalFeatures?: string[];
    forceSingleView?: boolean;
    overscanFovFactor?: number;
    enableOverscanSurfaceScale?: boolean;
    domOverlayRoot?: Element;
    onSessionEnd?: () => void;
}>): JSX.Element {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement>(null);
    const webXRHelper = useMemo(
        () => new WebXRHelper(resolutionScale),
        [mode, requiredFeatures.join("-"), optionalFeatures.join("-"), forceSingleView, domOverlayRoot],
    );
    const initializationPromiseRef = useRef<Promise<void> | null>(null);
    const [xrSession, setXrSession] = useState<XRSession | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!webXRHelper) {
            return;
        }

        webXRHelper.resolution_scale = resolutionScale;
    }, [webXRHelper, resolutionScale]);

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
            console.debug("---- Initializing WebXR");

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
                        overscan_fov_factor: overscanFovFactor,
                        enable_overscan_surface_scale: enableOverscanSurfaceScale,
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

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
export const WebXRContext = createContext<{
    webXRHelper: WebXRHelper | null;
}>({
    webXRHelper: null,
});

//------------------------------------------------------------------------------
/**
 * A component that provides a WebXR session
 *
 * @param params
 * @param params.mode - The mode of the XR session.
 * @param params.resolution_scale - The resolution scale of the XR session.
 * @param params.onSessionEnd - The callback to call when the XR session ends.
 *
 * @category Components
 */
export function WebXR({
    children,
    mode,
    resolutionScale = 1,
    requiredFeatures = [],
    optionalFeatures = [],
    forceSingleView,
    onSessionEnd,
}: PropsWithChildren<{
    mode: XRSessionMode;
    resolutionScale?: number;
    requiredFeatures?: string[];
    optionalFeatures?: string[];
    forceSingleView?: boolean;
    onSessionEnd?: () => void;
}>): JSX.Element {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement>(null);
    const webXRHelper = useMemo(() => new WebXRHelper(resolutionScale), []);
    const [xrSession, setXrSession] = useState<XRSession | null>(null);
    const initializationPromiseRef = useRef<Promise<void> | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!webXRHelper) {
            return;
        }

        webXRHelper.resolution_scale = resolutionScale;
    }, [webXRHelper, resolutionScale]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current || !instance) {
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
                        domOverlay: { root: containerRef.current },
                    },
                    forceSingleView,
                })
                .then(session => {
                    setXrSession(session);
                    console.debug("---- Setting XR viewports");
                    const enableOverscan = true;
                    return webXRHelper.configureViewports(instance, enableOverscan);
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
            webXRHelper.release();
        };
    }, [webXRHelper, instance]);

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
    return (
        <WebXRContext.Provider
            value={{
                webXRHelper,
            }}
        >
            <div data-role="webxr-dom-overlay" ref={containerRef}>
                {children}
            </div>
        </WebXRContext.Provider>
    );
}

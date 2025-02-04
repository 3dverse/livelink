//------------------------------------------------------------------------------
import React, { type PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { WebXRHelper } from "../../web-xr/WebXRHelper";

//------------------------------------------------------------------------------
/**
 * Context that provides utilities for WebXR.
 *
 * @category Context Providers
 */
export const WebXRContext = createContext<{
    webXRHelper: WebXRHelper | null;
}>({
    webXRHelper: null,
});

//------------------------------------------------------------------------------
/**
 * A component that provides a WebXR session
 * @param param
 *
 * @param param.mode - The mode of the XR session.
 * @param param.resolution_scale - The resolution scale of the XR session.
 * @param param.onSessionEnd - The callback to call when the XR session ends.
 */
export function WebXR({
    children,
    mode,
    resolutionScale = 1,
    onSessionEnd,
}: PropsWithChildren<{
    mode: XRSessionMode;
    resolutionScale?: number;
    onSessionEnd?: () => void;
}>): JSX.Element {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement>(null);
    const [webXRHelper, setWebXRHelper] = useState<WebXRHelper | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const webXRHelper = new WebXRHelper(resolutionScale);

        webXRHelper
            .initialize(mode, {
                optionalFeatures: ["dom-overlay"],
                domOverlay: { root: containerRef.current },
            })
            .then(() => {
                setWebXRHelper(webXRHelper);
            });

        return (): void => {
            webXRHelper.release();
            setWebXRHelper(null);
        };
    }, [mode]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!webXRHelper) {
            return;
        }

        webXRHelper.resolution_scale = resolutionScale;
    }, [webXRHelper, resolutionScale]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!webXRHelper || !onSessionEnd) {
            return;
        }

        webXRHelper.session!.addEventListener("end", onSessionEnd);

        return (): void => {
            webXRHelper.session!.removeEventListener("end", onSessionEnd);
        };
    }, [webXRHelper, onSessionEnd]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!webXRHelper || !instance) {
            return;
        }

        console.debug("---- Setting XR viewports");

        webXRHelper.configureViewports(instance).then(() => webXRHelper.start());
        return (): void => {
            webXRHelper.stop();
        };
    }, [webXRHelper, instance]);

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

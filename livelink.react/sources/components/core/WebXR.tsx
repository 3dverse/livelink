//------------------------------------------------------------------------------
import React, { type PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import { Viewport } from "@3dverse/livelink";

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
 * @param param0
 * @returns
 */
export function WebXR({ children, mode }: PropsWithChildren<{ mode: XRSessionMode }>) {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement>(null);
    const [webXRHelper, setWebXRHelper] = useState<WebXRHelper | null>(null);
    const [viewports, setViewports] = useState<Viewport[] | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const webXRHelper = new WebXRHelper();

        webXRHelper
            .initialize(mode, {
                optionalFeatures: ["dom-overlay"],
                domOverlay: { root: containerRef.current },
            })
            .then(() => {
                setWebXRHelper(webXRHelper);
            });

        return () => {
            webXRHelper.release();
            setWebXRHelper(null);
        };
    }, [mode]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!webXRHelper || !instance) {
            return;
        }

        webXRHelper.configureViewports(instance).then(setViewports);
    }, [webXRHelper, instance]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!viewports || !webXRHelper) {
            return;
        }

        webXRHelper.start();
    }, [viewports, webXRHelper]);

    //--------------------------------------------------------------------------
    return (
        <WebXRContext.Provider
            value={{
                webXRHelper,
            }}
        >
            <div role="webxr-dom-overlay" ref={containerRef}>
                {children}
            </div>
        </WebXRContext.Provider>
    );
}

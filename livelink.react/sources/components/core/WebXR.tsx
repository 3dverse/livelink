import React, { type PropsWithChildren, useContext, useEffect, useRef, useState } from "react";
import { Viewport } from "@3dverse/livelink";

import { LivelinkContext } from "./Livelink";
import { WebXRHelper } from "../../web-xr/WebXRHelper";

//------------------------------------------------------------------------------
export function WebXR({ children, mode }: PropsWithChildren<{ mode: XRSessionMode }>) {
    const { instance } = useContext(LivelinkContext);

    const containerRef = useRef<HTMLDivElement>(null);
    const [webXRHelper, setWebXRHelper] = useState<WebXRHelper | null>(null);
    const [viewports, setViewports] = useState<Viewport[] | null>(null);

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
    }, [mode, containerRef.current]);

    useEffect(() => {
        if (!webXRHelper || !instance) {
            return;
        }

        webXRHelper.configureViewports(instance).then(setViewports);
    }, [webXRHelper, instance]);

    useEffect(() => {
        if (!viewports || !webXRHelper) {
            return;
        }

        webXRHelper.createCameras().then(() => {
            for (const viewport of viewports) {
                viewport.__markViewportAsReady();
            }
            webXRHelper.start();
        });
    }, [viewports, webXRHelper]);

    return (
        <div role="webxr-dom-overlay" ref={containerRef}>
            {children}
        </div>
    );
}

//------------------------------------------------------------------------------
import React, { type JSX, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import type { Viewport } from "@3dverse/livelink";
import type { XRLivelink } from "../XRLivelink";
import { VirtualViewportProvider } from "./VirtualViewportProvider";

//------------------------------------------------------------------------------
/**
 * Renders virtual viewport providers for each WebXR viewport
 *
 * @category Components
 */
export function XRVirtualViewports({
    xrLivelink,
    renderViewport,
    viewports,
    domOverlayRoot,
}: {
    /**
     * XRLivelink instance used to listen for viewport updates
     */
    xrLivelink: XRLivelink | null;
    /**
     * Render function called for each WebXR viewport
     */
    renderViewport?: (viewport: Viewport, index: number) => React.ReactNode;

    /**
     * Array of configured viewports
     */
    viewports: ReadonlyArray<Viewport>;

    /**
     * Optional DOM overlay root element
     */
    domOverlayRoot?: Element;

}): JSX.Element | null {
    //--------------------------------------------------------------------------
    const [viewportUpdateCounter, setViewportUpdateCounter] = useState(0);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!xrLivelink) {
            return;
        }

        const onViewportUpdated = (): void => {
            setViewportUpdateCounter(counter => counter + 1);
        };

        xrLivelink.addEventListener("on-viewport-updated", onViewportUpdated);

        return (): void => {
            xrLivelink.removeEventListener("on-viewport-updated", onViewportUpdated);
        };
    }, [xrLivelink, viewports.length]);

    //--------------------------------------------------------------------------
    return useMemo(() => {
        if (!renderViewport || viewports.length === 0) {
            return null;
        }

        if(!domOverlayRoot) {
            return null;
        }

        return (
            <>
                {viewports.map((viewport, index) => (
                    <VirtualViewportProvider
                        key={`xr-virtual-viewport-${index}`}
                        viewport={viewport}
                        domOverlayRoot={domOverlayRoot}
                        index={index}
                    >
                        {renderViewport(viewport, index)}
                    </VirtualViewportProvider>
                ))}
            </>
        );
    }, [renderViewport, viewports, domOverlayRoot, viewportUpdateCounter]);
}

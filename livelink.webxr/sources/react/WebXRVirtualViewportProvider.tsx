//------------------------------------------------------------------------------
import React, { JSX, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

//------------------------------------------------------------------------------
import type { Viewport } from "@3dverse/livelink";
import { ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
/**
 * Virtual viewport provider that creates a ViewportContext for a WebXR viewport
 */
export function WebXRVirtualViewportProvider({
    viewport,
    index,
    children,
    domOverlayRoot,
}: {
    viewport: Viewport;
    index: number;
    children: React.ReactNode;
    domOverlayRoot: Element;
}): JSX.Element {
    //--------------------------------------------------------------------------
    // Ref for the outer viewport element
    const outerElementRef = useRef<HTMLDivElement>(null);
    const innerElementRef = useRef<HTMLDivElement>(null);

    //--------------------------------------------------------------------------
    // Compute viewport dimensions and positioning
    const viewportLayout = useMemo(() => {
        // Get root DOM overlay dimensions to compute displayable viewport size
        const rootRect = domOverlayRoot.getBoundingClientRect();
        const rootWidth = rootRect.width;
        const rootHeight = rootRect.height;

        // Compute displayable position and size from relative rect (clipped to screen)
        const displayableLeft = viewport.relative_rect.left * rootWidth;
        const displayableTop = viewport.relative_rect.top * rootHeight;
        const displayableWidth = viewport.relative_rect.width * rootWidth;
        const displayableHeight = viewport.relative_rect.height * rootHeight;

        // Use actual viewport dimensions for the desired size
        const desiredWidth = viewport.width;
        const desiredHeight = viewport.height;

        // Check if inner element is needed (when desired size differs from displayable size)
        // This can happen when overscan is enabled, or if the viewport is configured larger than the displayable area
        const needsInnerElement = desiredWidth !== displayableWidth || desiredHeight !== displayableHeight;

        // Center the content within the displayable area if using inner element
        const offsetX = needsInnerElement ? (displayableWidth - desiredWidth) / 2 : 0;
        const offsetY = needsInnerElement ? (displayableHeight - desiredHeight) / 2 : 0;

        return {
            displayableLeft,
            displayableTop,
            displayableWidth,
            displayableHeight,
            desiredWidth,
            desiredHeight,
            overscanEnabled: needsInnerElement,
            offsetX,
            offsetY,
        };
    }, [
        viewport.relative_rect.left,
        viewport.relative_rect.top,
        viewport.relative_rect.width,
        viewport.relative_rect.height,
        viewport.width,
        viewport.height,
        domOverlayRoot,
    ]);

    //--------------------------------------------------------------------------
    // Create ViewportContext value
    const viewportContextValue = useMemo(
        () => ({
            viewport,
            // Use inner element if overscan is enabled, otherwise use outer element
            viewportDomElement: viewportLayout.overscanEnabled ? innerElementRef.current : outerElementRef.current,
            zIndex: viewport.z_index,
            camera: viewport.camera_projection,
        }),
        [viewport, viewportLayout.overscanEnabled],
    );

    //--------------------------------------------------------------------------
    // Outer viewport styles
    const outerStyles: React.CSSProperties = {
        position: "absolute",
        left: `${viewportLayout.displayableLeft}px`,
        top: `${viewportLayout.displayableTop}px`,
        width: `${viewportLayout.displayableWidth}px`,
        height: `${viewportLayout.displayableHeight}px`,
        overflow: "hidden", // Clip content that exceeds displayable area
        pointerEvents: "none",
    };

    //--------------------------------------------------------------------------
    // Inner viewport styles (only when needed)
    const innerStyles: React.CSSProperties = {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: `${viewportLayout.desiredWidth}px`,
        height: `${viewportLayout.desiredHeight}px`,
        transform: `translate(${viewportLayout.offsetX}px, ${viewportLayout.offsetY}px)`,
        transformOrigin: "top left",
    };

    //--------------------------------------------------------------------------
    const content = (
        <div
            ref={outerElementRef}
            style={outerStyles}
            data-role="xr-virtual-viewport"
            data-viewport-index={index.toString()}
        >
            {viewportLayout.overscanEnabled ? (
                <div ref={innerElementRef} style={innerStyles} data-role="xr-virtual-viewport-overscan">
                    {children}
                </div>
            ) : (
                children
            )}
        </div>
    );

    //--------------------------------------------------------------------------
    return (
        <ViewportContext.Provider value={viewportContextValue}>
            {createPortal(content, domOverlayRoot)}
        </ViewportContext.Provider>
    );
}

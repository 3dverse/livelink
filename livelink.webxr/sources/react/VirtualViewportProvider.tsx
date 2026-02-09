import type { Viewport } from "@3dverse/livelink";
import { ViewportContext } from "@3dverse/livelink-react";
import React, { JSX, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

//------------------------------------------------------------------------------
/**
 * Virtual viewport provider that creates a ViewportContext for a WebXR viewport
 */
export function VirtualViewportProvider({
    viewport,
    index,
    children,
    rootDomOverlay,
}: {
    viewport: Viewport;
    index: number;
    children: React.ReactNode;
    rootDomOverlay: Element | null;
}): JSX.Element {
    // Create a virtual DOM element that matches the viewport size
    const { viewportDomElement, innerViewportElement } = useMemo(() => {
        // Outer element: represents the displayable area (clipped to screen)
        const outerElement = document.createElement("div");
        outerElement.style.position = "absolute";
        outerElement.style.overflow = "hidden"; // Clip content that exceeds displayable area

        // Get root DOM overlay dimensions to compute displayable viewport size
        const rootRect = rootDomOverlay?.getBoundingClientRect();
        const rootWidth = rootRect?.width || 0;
        const rootHeight = rootRect?.height || 0;

        // Compute displayable position and size from relative rect (clipped to screen)
        const displayableLeft = viewport.relative_rect.left * rootWidth;
        const displayableTop = viewport.relative_rect.top * rootHeight;
        const displayableWidth = viewport.relative_rect.width * rootWidth;
        const displayableHeight = viewport.relative_rect.height * rootHeight;

        outerElement.style.left = `${displayableLeft}px`;
        outerElement.style.top = `${displayableTop}px`;
        outerElement.style.width = `${displayableWidth}px`;
        outerElement.style.height = `${displayableHeight}px`;
        outerElement.style.pointerEvents = "none";
        outerElement.setAttribute("data-role", "xr-virtual-viewport-outer");
        outerElement.setAttribute("data-viewport-index", index.toString());

        // Inner element: represents the full desired viewport dimensions
        const innerElement = document.createElement("div");
        innerElement.style.position = "absolute";
        innerElement.style.left = "0px";
        innerElement.style.top = "0px";

        // Use actual viewport dimensions for the inner element
        const desiredWidth = viewport.width;
        const desiredHeight = viewport.height;

        // Center the content within the displayable area
        const offsetX = (displayableWidth - desiredWidth) / 2;
        const offsetY = (displayableHeight - desiredHeight) / 2;

        innerElement.style.width = `${desiredWidth}px`;
        innerElement.style.height = `${desiredHeight}px`;
        innerElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        innerElement.style.transformOrigin = "top left";
        innerElement.setAttribute("data-role", "xr-virtual-viewport-inner");

        // Append inner to outer
        outerElement.appendChild(innerElement);

        return {
            viewportDomElement: outerElement,
            innerViewportElement: innerElement,
        };
    }, [
        viewport.relative_rect.left,
        viewport.relative_rect.top,
        viewport.relative_rect.width,
        viewport.relative_rect.height,
        viewport.width,
        viewport.height,
        index,
        rootDomOverlay,
    ]);

    // Append the virtual DOM element to the root DOM overlay
    useEffect(() => {
        if (!rootDomOverlay) {
            return;
        }

        rootDomOverlay.appendChild(viewportDomElement);
        return (): void => {
            rootDomOverlay.removeChild(viewportDomElement);
        };
    }, [viewportDomElement, rootDomOverlay]);

    //--------------------------------------------------------------------------
    // Clean up the viewport when the component is unmounted
    useEffect(() => {
        return (): void => {
            viewportDomElement.remove();
        };
    }, [viewportDomElement]);

    // Create ViewportContext value
    const viewportContextValue = useMemo(
        () => ({
            viewport,
            viewportDomElement: innerViewportElement, // Use the inner element for content placement
            zIndex: viewport.z_index,
            camera: viewport.camera_projection,
        }),
        [viewport, innerViewportElement],
    );

    const portal = createPortal(children, innerViewportElement);
    return <ViewportContext.Provider value={viewportContextValue}>{portal}</ViewportContext.Provider>;
}

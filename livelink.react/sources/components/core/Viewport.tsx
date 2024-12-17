//------------------------------------------------------------------------------
import React, { HTMLProps, MouseEventHandler, useCallback, useEffect, useRef } from "react";

//------------------------------------------------------------------------------
import { RelativeRect, RenderingSurface, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { CanvasContext } from "./Canvas";
import { Camera } from "./Camera";

//------------------------------------------------------------------------------
export const ViewportContext = React.createContext<{
    viewport: Viewport | null;
    viewportDomElement: HTMLDivElement | null;
    zIndex: number;
}>({
    viewport: null,
    viewportDomElement: null,
    zIndex: 0,
});

//------------------------------------------------------------------------------
function computeRelativeRect(viewportDomElement: HTMLDivElement, canvas: HTMLCanvasElement) {
    const clientRect = viewportDomElement.getBoundingClientRect();
    const canvasPos = canvas.getBoundingClientRect();
    const relativePos = {
        left: clientRect.left - canvasPos.left,
        top: clientRect.top - canvasPos.top,
    };

    return new RelativeRect({
        left: parseFloat((relativePos.left / canvasPos.width).toPrecision(6)),
        top: parseFloat((relativePos.top / canvasPos.height).toPrecision(6)),
        width: parseFloat((clientRect.width / canvasPos.width).toPrecision(6)),
        height: parseFloat((clientRect.height / canvasPos.height).toPrecision(6)),
    });
}

//------------------------------------------------------------------------------
function ViewportProvider({ children, ...props }: React.PropsWithChildren & HTMLProps<HTMLDivElement>) {
    const { instance } = React.useContext(LivelinkContext);
    const { renderingSurface, canvas } = React.useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = React.useContext(ViewportContext);

    const [viewport, setViewport] = React.useState<Viewport | null>(null);
    const viewportDomElement = useRef<HTMLDivElement>(null);

    const onResize = useCallback(() => {
        if (!viewportDomElement.current || !canvas || !viewport) {
            return;
        }

        console.log("---- Resizing viewport", viewportDomElement.current);
        viewport.rect = computeRelativeRect(viewportDomElement.current, canvas);
    }, [viewport, canvas, viewportDomElement.current]);

    useEffect(() => {
        if (!viewportDomElement.current) {
            return;
        }

        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(viewportDomElement.current);
        return () => {
            resizeObserver.disconnect();
        };
    }, [viewportDomElement.current, onResize]);

    useEffect(() => {
        if (!renderingSurface) {
            return;
        }

        renderingSurface.addEventListener("on-resized", onResize);
        return () => {
            renderingSurface.removeEventListener("on-resized", onResize);
        };
    }, [renderingSurface, onResize]);

    const zIndex = parentZIndex + 1;

    useEffect(() => {
        if (!instance || !renderingSurface || !canvas || !viewportDomElement.current) {
            return;
        }

        const rect = computeRelativeRect(viewportDomElement.current, canvas);

        const viewport = new Viewport(instance, renderingSurface, { rect, z_index: zIndex });
        console.log("---- Setting viewport", viewport.width, viewport.height, zIndex);
        instance.addViewports({ viewports: [viewport] });
        setViewport(viewport);

        return () => {
            console.log("---- Removing viewport");
            instance.removeViewport({ viewport });
            viewport.release();
            setViewport(null);
        };
    }, [instance, renderingSurface, canvas, zIndex]);

    const hasCameras = React.Children.toArray(children).some(child => {
        return React.isValidElement(child) && child.type === Camera;
    });

    if (!hasCameras) {
        throw "Viewport must have a Camera as a child.";
    }

    return (
        <ViewportContext.Provider
            value={{
                viewport,
                viewportDomElement: viewportDomElement.current,
                zIndex,
            }}
        >
            <div ref={viewportDomElement} role={"viewport"} {...props}>
                {children}
            </div>
        </ViewportContext.Provider>
    );
}

//------------------------------------------------------------------------------
export { ViewportProvider as Viewport };

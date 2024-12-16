//------------------------------------------------------------------------------
import React, { HTMLProps, MouseEventHandler, useEffect, useRef } from "react";

//------------------------------------------------------------------------------
import { RelativeRect, Viewport } from "@3dverse/livelink";

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
function ViewportProvider({ children, ...props }: React.PropsWithChildren & HTMLProps<HTMLDivElement>) {
    const { instance } = React.useContext(LivelinkContext);
    const { renderingSurface } = React.useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = React.useContext(ViewportContext);

    const [viewport, setViewport] = React.useState<Viewport | null>(null);
    const viewportDomElement = useRef<HTMLDivElement>(null);

    const zIndex = parentZIndex + 1;

    useEffect(() => {
        if (!instance || !renderingSurface || !viewportDomElement.current) {
            return;
        }

        //TO_CLEAN!
        const clientRect = viewportDomElement.current.getBoundingClientRect();
        console.log("CLIENT RECT", clientRect);
        const parentPos = viewportDomElement.current.parentElement!.getBoundingClientRect();
        const relativePos = {
            left: clientRect.left - parentPos.left,
            top: clientRect.top - parentPos.top,
        };
        const rect = new RelativeRect({
            left: relativePos.left / renderingSurface.width,
            top: relativePos.top / renderingSurface.height,
            width: clientRect.width / renderingSurface.width,
            height: clientRect.height / renderingSurface.height,
        });
        //TO_CLEAN!

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
    }, [instance, renderingSurface, zIndex]);

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

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
function ViewportProvider({
    children,
    rect = { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 },
    ...props
}: React.PropsWithChildren<{
    rect?: {
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
        width?: number;
        height?: number;
    };
}> &
    HTMLProps<HTMLDivElement>) {
    const { instance } = React.useContext(LivelinkContext);
    const { renderingSurface } = React.useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = React.useContext(ViewportContext);

    const [viewport, setViewport] = React.useState<Viewport | null>(null);
    const viewportDomElement = useRef<HTMLDivElement>(null);

    const zIndex = parentZIndex + 1;

    useEffect(() => {
        if (!instance || !renderingSurface) {
            return;
        }

        const viewport = new Viewport(instance, renderingSurface, { rect: new RelativeRect(rect), z_index: zIndex });
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
            <div
                ref={viewportDomElement}
                role={"viewport"}
                style={{
                    position: "absolute",
                    width: viewport?.width,
                    height: viewport?.height,
                    left: viewport?.offset[0],
                    top: viewport?.offset[1],
                    zIndex: 10 + parentZIndex,
                    padding: "inherit",
                    overflow: "hidden",
                }}
                {...props}
            >
                {children}
            </div>
        </ViewportContext.Provider>
    );
}

//------------------------------------------------------------------------------
export { ViewportProvider as Viewport };

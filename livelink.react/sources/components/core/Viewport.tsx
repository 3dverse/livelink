//------------------------------------------------------------------------------
import React, {
    createContext,
    HTMLProps,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

//------------------------------------------------------------------------------
import { RelativeRect, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { CanvasContext } from "./Canvas";
import { Camera } from "./Camera";

//------------------------------------------------------------------------------
export const ViewportContext = createContext<{
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
function ViewportProvider({ children, ...props }: PropsWithChildren & HTMLProps<HTMLDivElement>) {
    const { instance } = useContext(LivelinkContext);
    const { renderingSurface, canvas } = useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = useContext(ViewportContext);

    const [viewport, setViewport] = useState<Viewport | null>(null);
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

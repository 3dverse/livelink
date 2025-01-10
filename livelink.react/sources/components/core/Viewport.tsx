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
import * as Livelink from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { CanvasContext } from "./Canvas";

/**
 * Context that provides a viewport.
 *
 * @category Context Providers
 */
export const ViewportContext = createContext<{
    viewport: Livelink.Viewport | null;
    viewportDomElement: HTMLDivElement | null;
    zIndex: number;
    camera: Livelink.CameraProjection | null;
}>({
    viewport: null,
    viewportDomElement: null,
    zIndex: 0,
    camera: null,
});

/**
 * A component that provides a viewport.
 *
 * @category Context Providers
 */
export function Viewport({
    cameraEntity,
    renderTargetIndex = -1,
    children,
    ...props
}: PropsWithChildren & {
    cameraEntity: Livelink.Entity | null;
    renderTargetIndex?: number;
} & HTMLProps<HTMLDivElement>) {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);
    const { renderingSurface, canvas } = useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = useContext(ViewportContext);

    //--------------------------------------------------------------------------
    const [viewport, setViewport] = useState<Livelink.Viewport | null>(null);
    const [camera, setCamera] = useState<Livelink.CameraProjection | null>(null);
    const viewportDomElement = useRef<HTMLDivElement>(null);

    //--------------------------------------------------------------------------
    const onResize = useCallback(() => {
        if (!viewportDomElement.current || !canvas || !viewport) {
            return;
        }

        console.log("---- Resizing viewport", viewportDomElement.current);
        viewport.relative_rect = Livelink.RelativeRect.from_dom_elements({
            element: viewportDomElement.current,
            parent: canvas,
        });
    }, [viewport, canvas, viewportDomElement.current]);

    //--------------------------------------------------------------------------
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

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!renderingSurface) {
            return;
        }

        renderingSurface.addEventListener("on-resized", onResize);
        return () => {
            renderingSurface.removeEventListener("on-resized", onResize);
        };
    }, [renderingSurface, onResize]);

    //--------------------------------------------------------------------------
    const zIndex = parentZIndex + 1;
    useEffect(() => {
        if (!instance || !renderingSurface || !canvas || !viewportDomElement.current) {
            return;
        }

        try {
            const rect = Livelink.RelativeRect.from_dom_elements({
                element: viewportDomElement.current,
                parent: canvas,
            });

            const viewport = new Livelink.Viewport({
                core: instance,
                rendering_surface: renderingSurface,
                options: {
                    rect,
                    z_index: zIndex,
                    render_target_index: renderTargetIndex,
                },
            });
            console.debug("---- Setting viewport", viewport.width, viewport.height, zIndex);
            instance.addViewports({ viewports: [viewport] });
            setViewport(viewport);

            return () => {
                console.debug("---- Removing viewport");
                instance.removeViewport({ viewport });
                viewport.release();
                setViewport(null);
            };
        } catch (error) {
            console.error("Failed to mount viewport", viewportDomElement.current, error);
        }
    }, [instance, renderingSurface, canvas, zIndex]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!viewport || !cameraEntity) {
            return;
        }

        console.log("---- Setting camera", cameraEntity);
        viewport.camera_projection = new Livelink.CameraProjection({ camera_entity: cameraEntity, viewport });
        setCamera(viewport.camera_projection);
    }, [viewport, cameraEntity]);

    //--------------------------------------------------------------------------
    return (
        <ViewportContext.Provider
            value={{
                viewport,
                viewportDomElement: viewportDomElement.current,
                zIndex,
                camera: camera,
            }}
        >
            <div ref={viewportDomElement} role={"viewport"} {...props}>
                {children}
            </div>
        </ViewportContext.Provider>
    );
}

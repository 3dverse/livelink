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

//------------------------------------------------------------------------------
type UnionKeys<T> = T extends T ? keyof T : never;
type StrictUnionHelper<T, TAll> = T extends unknown
    ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>>
    : never;
type StrictUnion<T> = StrictUnionHelper<T, T>;

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
    renderTargetIndex = -1,
    children,
    ...props
}: PropsWithChildren<
    StrictUnion<
        | {
              cameraEntity: Livelink.Entity | null;
          }
        | {
              client: Livelink.Client;
              cameraIndex?: number;
          }
    > & {
        renderTargetIndex?: number;
    } & HTMLProps<HTMLDivElement>
>): JSX.Element {
    const { cameraEntity, client, cameraIndex, ...otherProps } = props as {
        cameraEntity?: Livelink.Entity | null;
        cameraIndex?: number;
        client?: Livelink.Client;
    } & HTMLProps<HTMLDivElement>;

    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);
    const { renderingSurface, canvas } = useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = useContext(ViewportContext);

    //--------------------------------------------------------------------------
    const [viewport, setViewport] = useState<Livelink.Viewport | null>(null);
    const [clientCameraEntity, setClientCameraEntity] = useState<Livelink.Entity | null>(null);
    const [camera, setCamera] = useState<Livelink.CameraProjection | null>(null);
    const viewportDomElement = useRef<HTMLDivElement>(null);

    //--------------------------------------------------------------------------
    const onResize = useCallback(() => {
        if (!viewportDomElement.current || !canvas || !viewport) {
            return;
        }

        console.debug("---- Resizing viewport", viewportDomElement.current);
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
        return (): void => {
            resizeObserver.disconnect();
        };
    }, [viewportDomElement.current, onResize]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!renderingSurface) {
            return;
        }

        renderingSurface.addEventListener("on-resized", onResize);
        return (): void => {
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

            return (): void => {
                console.debug("---- Removing viewport");
                instance.removeViewport({ viewport });
                viewport.release();
                setViewport(null);
            };
        } catch (error) {
            if (error instanceof Livelink.OutOfBoundsError) {
                console.error(
                    "A viewport MUST be contained into its parent Canvas bounds",
                    viewportDomElement.current,
                    canvas,
                );
            } else if (error instanceof Livelink.InvalidSizeError) {
                console.error(
                    `Viewport element has an invalid size : [${error.rect.width} x ${error.rect.height}].`,
                    canvas,
                );
            } else {
                console.error("Failed to mount viewport", viewportDomElement.current, error);
            }
        }
    }, [instance, renderingSurface, canvas, zIndex]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (client) {
            client.getCameraEntities().then(cameraEntities => {
                setClientCameraEntity(cameraEntities[cameraIndex ?? 0]);
            });
        } else {
            setClientCameraEntity(cameraEntity ?? null);
        }
    }, [cameraEntity, client, cameraIndex]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!viewport || !clientCameraEntity) {
            return;
        }

        console.debug("---- Setting camera", clientCameraEntity);
        viewport.camera_projection = new Livelink.CameraProjection({ camera_entity: clientCameraEntity, viewport });
        setCamera(viewport.camera_projection);
    }, [viewport, clientCameraEntity]);

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
            <div ref={viewportDomElement} role={"viewport"} {...otherProps}>
                {children}
            </div>
        </ViewportContext.Provider>
    );
}

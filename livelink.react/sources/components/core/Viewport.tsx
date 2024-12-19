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
import { Entity, RelativeRect, Camera } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { CanvasContext } from "./Canvas";
import { EntityProvider, useEntity } from "../../hooks/useEntity";

//------------------------------------------------------------------------------
export const ViewportContext = createContext<{
    viewport: Livelink.Viewport | null;
    cameraEntity: Entity | null;
    viewportDomElement: HTMLDivElement | null;
    zIndex: number;
}>({
    viewport: null,
    cameraEntity: null,
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

    const PRECISION = 6 as const;

    return new RelativeRect({
        left: parseFloat((relativePos.left / canvasPos.width).toPrecision(PRECISION)),
        top: parseFloat((relativePos.top / canvasPos.height).toPrecision(PRECISION)),
        width: parseFloat((clientRect.width / canvasPos.width).toPrecision(PRECISION)),
        height: parseFloat((clientRect.height / canvasPos.height).toPrecision(PRECISION)),
    });
}

//------------------------------------------------------------------------------
export function Viewport({
    cameraProvider = { class: DefaultCamera, name: "Default Camera" },
    children,
    ...props
}: PropsWithChildren & { cameraProvider?: EntityProvider } & HTMLProps<HTMLDivElement>) {
    const { instance } = useContext(LivelinkContext);
    const { renderingSurface, canvas } = useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = useContext(ViewportContext);

    const { entity: cameraEntity } = useEntity(cameraProvider);

    const [viewport, setViewport] = useState<Livelink.Viewport | null>(null);
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

        const viewport = new Livelink.Viewport(instance, renderingSurface, { rect, z_index: zIndex });
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

    useEffect(() => {
        if (!viewport || !cameraEntity) {
            return;
        }

        console.log("---- Setting camera", cameraEntity);
        const camera = new Camera({ camera_entity: cameraEntity, viewport });
        viewport.camera = camera;
        viewport.TO_REMOVE__markViewportAsReady();
    }, [viewport, cameraEntity]);

    return (
        <ViewportContext.Provider
            value={{
                viewport,
                viewportDomElement: viewportDomElement.current,
                zIndex,
                cameraEntity,
            }}
        >
            <div ref={viewportDomElement} role={"viewport"} {...props}>
                {children}
            </div>
        </ViewportContext.Provider>
    );
}

//------------------------------------------------------------------------------
export class DefaultCamera extends Entity {
    //--------------------------------------------------------------------------
    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 1, 5] };
        this.camera = {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: true, skybox: false, gradient: true },
        };
        this.perspective_lens = {
            fovy: 60,
            nearPlane: 0.1,
            farPlane: 10000,
        };
    }
}

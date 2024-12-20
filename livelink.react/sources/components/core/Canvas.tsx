//------------------------------------------------------------------------------
import React, {
    createContext,
    CSSProperties,
    HTMLProps,
    PropsWithChildren,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { RenderingSurface } from "@3dverse/livelink";
import { ViewportContext } from "./Viewport";

//------------------------------------------------------------------------------
export const CanvasContext = createContext<{
    canvas: HTMLCanvasElement | null;
    renderingSurface: RenderingSurface | null;
}>({
    canvas: null,
    renderingSurface: null,
});

//------------------------------------------------------------------------------
type CanvasContext =
    | {
          contextType: "2d";
          contextAttributes?: CanvasRenderingContext2DSettings;
      }
    | {
          contextType: "webgl";
          contextAttributes?: WebGLContextAttributes & { xrCompatible?: boolean };
      }
    | {
          contextType?: undefined;
          contextAttributes?: undefined;
      };

//------------------------------------------------------------------------------
export function Canvas({
    children,
    width,
    height,
    contextType = "2d",
    contextAttributes,
    ...props
}: PropsWithChildren<CanvasContext & HTMLProps<HTMLDivElement>>) {
    const { instance } = useContext(LivelinkContext);
    const { canvas: parentCanvas } = useContext(CanvasContext);
    const { zIndex } = useContext(ViewportContext);

    const [renderingSurface, setRenderingSurface] = useState<RenderingSurface | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!instance || !canvasRef.current) {
            return;
        }

        console.debug("--- Setting rendering surface");
        const surface = new RenderingSurface({
            canvas_element: canvasRef.current,
            context_type: contextType,
            context_attributes: contextAttributes,
        });

        setRenderingSurface(surface);

        return () => {
            console.debug("--- Removing rendering surface");
            surface.release();
            setRenderingSurface(null);
        };
    }, [instance, contextType, contextAttributes]);

    return (
        <CanvasContext.Provider value={{ canvas: canvasRef.current, renderingSurface }}>
            <div
                role="canvas-container"
                style={computeCanvasContainerStyle({ parentCanvas, width, height, zIndex })}
                {...props}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                    }}
                />
                {children}
            </div>
        </CanvasContext.Provider>
    );
}

//------------------------------------------------------------------------------
function computeCanvasContainerStyle({
    parentCanvas,
    zIndex,
    width,
    height,
}: {
    parentCanvas: HTMLCanvasElement | null;
    zIndex: number;
    width?: string | number;
    height?: string | number;
}): CSSProperties {
    const isNestedCanvas = Boolean(parentCanvas);
    const commonStyle = { overflow: "clip", zIndex } satisfies CSSProperties;
    const nestedCanvasStyle = { position: "absolute", width, height } satisfies CSSProperties;
    const rootCanvasStyle = {
        position: "relative",
        width: width ?? "100%",
        height: height ?? "100%",
    } satisfies CSSProperties;
    return { ...commonStyle, ...(isNestedCanvas ? nestedCanvasStyle : rootCanvasStyle) };
}

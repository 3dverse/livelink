//------------------------------------------------------------------------------
import React, {
    createContext,
    CSSProperties,
    HTMLProps,
    JSX,
    PropsWithChildren,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

//------------------------------------------------------------------------------
import { RenderingSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";

/**
 * A context provider that exposes the canvas element and the rendering surface.
 * @param canvas - The canvas element.
 * @param renderingSurface - The rendering surface.
 *
 * @category Context Providers
 */
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

/**
 * A component that provides a canvas element and a rendering surface.
 * @param param0 - The canvas context.
 * @property {ReactNode} children - The children to render.
 * @property {"2d" | "webgl"} contextType - The context type of the canvas.
 * @property {CanvasRenderingContext2DSettings | {WebGLContextAttributes & {boolean}}} contextAttributes - The context attributes of the canvas.
 * @property {number} width - The width of the canvas.
 * @property {number} height - The height of the canvas.
 * @returns The canvas component.
 *
 * @category Context Providers
 */
export function Canvas({
    children,
    contextType = "2d",
    contextAttributes,
    width,
    height,
    ...props
}: PropsWithChildren<CanvasContext & HTMLProps<HTMLDivElement>>): JSX.Element {
    const { instance } = useContext(LivelinkContext);
    const { canvas: parentCanvas } = useContext(CanvasContext);

    const [renderingSurface, setRenderingSurface] = useState<RenderingSurface | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!instance || !canvasRef.current) {
            return;
        }

        console.debug("--- Setting rendering surface");

        const rect = canvasRef.current.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            console.error(
                `Canvas element has an invalid size : [${rect.width} x ${rect.height}] it will not be mounted as a rendering surface.`,
                canvasRef.current,
            );
            return;
        }

        const surface = new RenderingSurface({
            canvas_element: canvasRef.current,
            context_type: contextType,
            context_attributes: contextAttributes,
        });

        setRenderingSurface(surface);

        return (): void => {
            console.debug("--- Removing rendering surface");
            surface.release();
            setRenderingSurface(null);
        };
    }, [instance, contextType, contextAttributes]);

    return (
        <CanvasContext.Provider value={{ canvas: canvasRef.current, renderingSurface }}>
            <div
                data-role="canvas-container"
                style={computeCanvasContainerStyle({ parentCanvas, width, height })}
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
    width,
    height,
}: {
    parentCanvas: HTMLCanvasElement | null;
    width?: string | number;
    height?: string | number;
}): CSSProperties {
    const isNestedCanvas = Boolean(parentCanvas);
    const commonStyle = { overflow: "clip" } satisfies CSSProperties;
    const nestedCanvasStyle = { position: "absolute", width, height } satisfies CSSProperties;
    const rootCanvasStyle = {
        position: "relative",
        width: width ?? "100%",
        height: height ?? "100%",
    } satisfies CSSProperties;
    return { ...commonStyle, ...(isNestedCanvas ? nestedCanvasStyle : rootCanvasStyle) };
}

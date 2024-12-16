import React, { HTMLProps, useContext, useEffect, useRef, useState } from "react";

import { LivelinkContext } from "./Livelink";
import { RenderingSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const CanvasContext = React.createContext<{
    canvas: HTMLCanvasElement | null;
    renderingSurface: RenderingSurface | null;
}>({
    canvas: null,
    renderingSurface: null,
});

//------------------------------------------------------------------------------
type CanvasContext =
    | {
          context_type: "2d";
          context_attributes?: CanvasRenderingContext2DSettings;
      }
    | {
          context_type: "webgl";
          context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean };
      }
    | {
          context_type?: undefined;
          context_attributes?: undefined;
      };

//------------------------------------------------------------------------------
export function Canvas({
    children,
    width,
    height,
    context_type = "2d",
    context_attributes,
    ...props
}: React.PropsWithChildren<
    CanvasContext & HTMLProps<HTMLDivElement> & { width?: string | number; height?: string | number }
>) {
    const { instance } = useContext(LivelinkContext);
    const [renderingSurface, setRenderingSurface] = useState<RenderingSurface | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { canvas } = useContext(CanvasContext);

    useEffect(() => {
        if (!instance || !canvasRef.current) {
            return;
        }

        console.log("--- Setting rendering surface");
        const surface = new RenderingSurface({
            canvas_element: canvasRef.current,
            context_type,
            context_attributes,
        });

        setRenderingSurface(surface);

        return () => {
            console.log("--- Removing rendering surface");
            surface.release();
            setRenderingSurface(null);
        };
    }, [instance, context_type, context_attributes]);

    return (
        <CanvasContext.Provider
            value={{
                canvas: canvasRef.current,
                renderingSurface,
            }}
        >
            <div
                role="canvas-container"
                style={
                    canvas
                        ? { width, height, position: "absolute", overflow: "clip" }
                        : { width: width ?? "100%", height: height ?? "100%", position: "relative", overflow: "clip" }
                }
                {...props}
            >
                <canvas
                    ref={canvasRef}
                    onContextMenu={event => event.preventDefault()}
                    tabIndex={1}
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

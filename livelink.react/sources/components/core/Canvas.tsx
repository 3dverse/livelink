import React, { HTMLProps, useEffect, useRef } from "react";

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
    context_type = "2d",
    context_attributes,
    ...props
}: React.PropsWithChildren<CanvasContext & HTMLProps<HTMLCanvasElement>>) {
    const { instance } = React.useContext(LivelinkContext);
    const [renderingSurface, setRenderingSurface] = React.useState<RenderingSurface | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
            <canvas
                ref={canvasRef}
                onContextMenu={event => event.preventDefault()}
                tabIndex={1}
                style={{ width: "100%", height: "100%" }}
                {...props}
            />
            {children}
        </CanvasContext.Provider>
    );
}

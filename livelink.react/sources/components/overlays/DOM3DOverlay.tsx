import React, { HTMLProps, useEffect, useRef, useState } from "react";
import { ReactOverlay } from "../../overlays/react/ReactOverlay";
import { ViewportContext } from "../core/Viewport";

//------------------------------------------------------------------------------
export const OverlayContext = React.createContext<ReactOverlay | null>(null);

//------------------------------------------------------------------------------
export function DOM3DOverlay({ children, ...props }: React.PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [overlay, setOverlay] = useState<ReactOverlay | null>(null);
    const { viewport } = React.useContext(ViewportContext);

    useEffect(() => {
        if (!viewport || !containerRef.current) {
            return;
        }

        const overlay = new ReactOverlay({ container: containerRef.current, viewport });
        viewport.addOverlay({ overlay });

        setOverlay(overlay);

        return () => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport, containerRef]);

    return (
        <OverlayContext.Provider value={overlay}>
            <div
                ref={containerRef}
                style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    top: "0",
                    zIndex: 10,
                    pointerEvents: "none",
                    padding: "inherit",
                    overflow: "hidden",
                }}
                {...props}
            >
                {children}
            </div>
        </OverlayContext.Provider>
    );
}

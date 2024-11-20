import React, { useEffect, useRef, useState } from "react";
import { ReactOverlay } from "../overlays/react/ReactOverlay";

import type { Livelink, RenderingSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const OverlayContext = React.createContext<ReactOverlay | null>(null);

//------------------------------------------------------------------------------
export function DOM3DOverlay({
    instance,
    children,
    style,
}: React.PropsWithChildren<{ instance: Livelink | null; style: React.CSSProperties }>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [overlay, setOverlay] = useState<ReactOverlay | null>(null);

    useEffect(() => {
        if (!instance || !containerRef.current) {
            return;
        }

        const overlay = new ReactOverlay({ container: containerRef.current });

        const renderingSurface = instance.viewports[0].rendering_surface as RenderingSurface;
        renderingSurface.addOverlay({ overlay });

        for (const viewport of instance.viewports) {
            overlay.addViewport({ viewport });
        }

        setOverlay(overlay);

        return () => {
            renderingSurface.removeOverlay({ overlay });
        };
    }, [instance, containerRef]);

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
                    ...style,
                }}
            >
                {children}
            </div>
        </OverlayContext.Provider>
    );
}

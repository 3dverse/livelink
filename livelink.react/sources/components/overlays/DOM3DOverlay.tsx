//------------------------------------------------------------------------------
import React, { createContext, HTMLProps, PropsWithChildren, useContext, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import { ViewportContext } from "../core/Viewport";
import { ReactOverlay } from "../../overlays/ReactOverlay";

/**
 * Context that provides an overlay.
 *
 * @category Context Providers
 */
export const OverlayContext = createContext<ReactOverlay | null>(null);

/**
 * A component that provides a DOM 3D overlay.
 *
 * @category Context Providers
 */
export function DOM3DOverlay({ children, ...props }: PropsWithChildren<HTMLProps<HTMLDivElement>>): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const [overlay, setOverlay] = useState<ReactOverlay | null>(null);
    const { viewport } = useContext(ViewportContext);

    useEffect(() => {
        if (!viewport || !containerRef.current) {
            return;
        }

        const overlay = new ReactOverlay({ container: containerRef.current, viewport });
        viewport.addOverlay({ overlay });

        setOverlay(overlay);

        return (): void => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport, containerRef]);

    return (
        <OverlayContext.Provider value={overlay}>
            <div
                ref={containerRef}
                role={"dom-3d-overlay"}
                style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    top: "0",
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

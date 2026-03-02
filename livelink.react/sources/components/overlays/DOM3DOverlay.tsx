//------------------------------------------------------------------------------
import React, { HTMLProps, JSX, PropsWithChildren, useContext, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import { ViewportContext } from "../core/Viewport";
import { DOM3DOverlayContainer } from "../../overlays/DOM3DOverlayContainer";
import { OverlayContext } from "../../contexts/OverlayContext";

/**
 * A DOM3DOverlay is a div that is rendered on top of a viewport and provides utilities for
 * projecting 3D positions to 2D screen space for its children components using the DOM3DOverlayContainer.
 *
 * @category Components
 */
export function DOM3DOverlay({ children, ...props }: PropsWithChildren<HTMLProps<HTMLDivElement>>): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const cameraProjectionRef = useRef<HTMLDivElement>(null);
    const cameraTransformRef = useRef<HTMLDivElement>(null);
    const [overlay, setOverlay] = useState<DOM3DOverlayContainer | null>(null);
    const { viewport } = useContext(ViewportContext);

    useEffect(() => {
        if (!viewport || !containerRef.current || !cameraProjectionRef.current || !cameraTransformRef.current) {
            return;
        }

        const overlay = new DOM3DOverlayContainer({
            container: containerRef.current,
            camera_projection_element: cameraProjectionRef.current,
            camera_transform_element: cameraTransformRef.current,
            viewport,
        });
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
                data-role="dom-3d-overlay-container"
                style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    padding: "inherit",
                    overflow: "hidden",
                }}
                {...props}
            >
                <div
                    ref={cameraProjectionRef}
                    data-role="dom-3d-overlay-camera-projection"
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    <div
                        ref={cameraTransformRef}
                        data-role="dom-3d-overlay-camera-transform"
                        style={{
                            transformStyle: "preserve-3d",
                            width: "100%",
                            height: "100%",
                        }}
                    ></div>
                </div>
                {children}
            </div>
        </OverlayContext.Provider>
    );
}

import { createElement, Fragment, PropsWithChildren, useContext, useEffect, useState } from "react";
import { OverlayContext } from "./DOM3DOverlay";

import type { Vec2i, Vec3 } from "@3dverse/livelink";
import type React3DElement from "../../overlays/React3DElement";

//------------------------------------------------------------------------------
export function DOM3DElement({
    worldPosition,
    pixelDimensions,
    scaleFactor,
    children,
}: PropsWithChildren<{
    worldPosition: Vec3;
    pixelDimensions: Vec2i;
    scaleFactor?: number;
}>) {
    const overlay = useContext(OverlayContext);
    const [elementHandle, setElementHandle] = useState<React3DElement | null>(null);

    useEffect(() => {
        if (!overlay) {
            return;
        }

        const element = createElement(Fragment, { children });
        const handle = overlay.addElement({ element, pixel_dimensions: pixelDimensions, scale_factor: scaleFactor });
        setElementHandle(handle);

        return () => {
            overlay.removeElement({ element });
        };
    }, [overlay, children]);

    useEffect(() => {
        if (!elementHandle) {
            return;
        }

        elementHandle.pixel_dimensions = pixelDimensions;
        elementHandle.world_position = worldPosition;
    }, [elementHandle, pixelDimensions, worldPosition]);

    return null;
}

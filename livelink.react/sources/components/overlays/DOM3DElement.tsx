import React, { useEffect, useState } from "react";
import { OverlayContext } from "./DOM3DOverlay";

import type { Vec2i, Vec3 } from "@3dverse/livelink";
import type React3DElement from "../../overlays/react/React3DElement";

//------------------------------------------------------------------------------
export function DOM3DElement({
    world_position,
    pixel_dimensions,
    scale_factor,
    children,
}: React.PropsWithChildren<{
    world_position: Vec3;
    pixel_dimensions: Vec2i;
    scale_factor?: number;
}>) {
    const overlay = React.useContext(OverlayContext);
    const [elementHandle, setElementHandle] = useState<React3DElement | null>(null);

    useEffect(() => {
        if (!overlay) {
            return;
        }

        const element = React.createElement(React.Fragment, { children });
        const handle = overlay.addElement({ element, pixel_dimensions, scale_factor });
        setElementHandle(handle);

        return () => {
            overlay.removeElement({ element });
        };
    }, [overlay, children]);

    useEffect(() => {
        if (!elementHandle) {
            return;
        }

        elementHandle.pixel_dimensions = pixel_dimensions;
        elementHandle.world_position = world_position;
    }, [elementHandle, pixel_dimensions, world_position]);

    return null;
}

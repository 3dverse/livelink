//------------------------------------------------------------------------------
import { createElement, Fragment, PropsWithChildren, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { type React3DElement } from "../../overlays/React3DElement";
import { OverlayContext } from "./DOM3DOverlay";

/**
 * A component that renders a 3D DOM element.
 *
 * @category Components
 */
export function DOM3DElement({
    worldPosition,
    scaleFactor,
    children,
}: PropsWithChildren<{
    worldPosition: Vec3;
    scaleFactor?: number;
}>): null {
    const overlay = useContext(OverlayContext);
    const [elementHandle, setElementHandle] = useState<React3DElement | null>(null);

    useEffect(() => {
        if (!overlay) {
            return;
        }

        const element = createElement(Fragment, { children });
        const handle = overlay.addElement({ element, scale_factor: scaleFactor, world_position: worldPosition });
        setElementHandle(handle);

        return (): void => {
            overlay.removeElement({ element });
        };
    }, [overlay, children, scaleFactor]);

    useEffect(() => {
        if (!elementHandle) {
            return;
        }

        elementHandle.world_position = worldPosition;
    }, [elementHandle, worldPosition[0], worldPosition[1], worldPosition[2]]);

    return null;
}

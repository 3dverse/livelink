//------------------------------------------------------------------------------
import React, { PropsWithChildren, useContext } from "react";
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { OverlayContext } from "./DOM3DOverlay";
import type { Anchor } from "../../overlays/React3DElement";

/**
 * A component that renders a 3D DOM element.
 *
 * @category Components
 */
export function DOM3DElement({
    worldPosition,
    anchor = "center",
    scaleFactor,
    children,
}: PropsWithChildren<{
    worldPosition: Vec3;
    anchor?: Anchor;
    scaleFactor?: number;
}>): React.JSX.Element | null {
    const overlay = useContext(OverlayContext);
    if (!overlay) {
        return null;
    }

    return (
        <overlay.DOM3DElement worldPosition={worldPosition} anchor={anchor} scaleFactor={scaleFactor}>
            {children}
        </overlay.DOM3DElement>
    );
}

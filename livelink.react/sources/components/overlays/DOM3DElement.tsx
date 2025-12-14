//------------------------------------------------------------------------------
import React, { useContext } from "react";

//------------------------------------------------------------------------------
import { OverlayContext } from "./DOM3DOverlay";
import { React3DElement, type React3DElementProps } from "../../overlays/React3DElement";

/**
 * A component that renders a 3D DOM element.
 *
 * @category Components
 */
export function DOM3DElement(props: React3DElementProps): React.JSX.Element | null {
    const { children, containerRef, ...otherProps } = props;
    const overlay = useContext(OverlayContext);
    if (!overlay) {
        return null;
    }

    return (
        <React3DElement overlay={overlay} containerRef={containerRef} {...otherProps}>
            {children}
        </React3DElement>
    );
}

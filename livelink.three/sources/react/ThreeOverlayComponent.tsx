import { useContext, useEffect } from "react";
import { ViewportContext } from "@3dverse/livelink-react";
import type * as THREE from "three";

import { ThreeOverlay } from "../ThreeOverlay";

//------------------------------------------------------------------------------
function ThreeOverlayComponent({ scene }: { scene: THREE.Scene }) {
    const { viewport } = useContext(ViewportContext);

    useEffect(() => {
        if (!viewport) {
            return;
        }

        const overlay = new ThreeOverlay({ viewport, scene });
        viewport.addOverlay({ overlay });

        return () => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport]);

    return null;
}

export { ThreeOverlayComponent as ThreeOverlay };

import { useContext, useEffect } from "react";
import * as THREE from "three";
import { ViewportContext } from "@3dverse/livelink-react";

import { ThreeOverlay } from "../ThreeOverlay";

//------------------------------------------------------------------------------
function ThreeOverlayComponent({ scene }: { scene: THREE.Scene }) {
    const { viewport } = useContext(ViewportContext);

    useEffect(() => {
        if (!viewport) {
            return;
        }

        console.warn("---- Adding ThreeOverlay", viewport);

        const overlay = new ThreeOverlay({ viewport, scene });
        viewport.addOverlay({ overlay });

        return () => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport]);

    return null;
}

export { ThreeOverlayComponent as ThreeOverlay };

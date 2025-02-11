//------------------------------------------------------------------------------
import React from "react";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { ViewportContext } from "@3dverse/livelink-react";
import type * as THREE from "three";

import { ThreeOverlay } from "../";

//------------------------------------------------------------------------------
export const ThreeOverlayContext = createContext<{
    overlay: ThreeOverlay | null;
}>({
    overlay: null,
});

//------------------------------------------------------------------------------
function ThreeOverlayProvider({ scene, children }: PropsWithChildren<{ scene: THREE.Scene }>) {
    const { viewport, camera } = useContext(ViewportContext);
    const [overlay, setOverlay] = useState<ThreeOverlay | null>(null);

    useEffect(() => {
        if (!viewport || !camera) {
            setOverlay(null);
            return;
        }

        const overlay = new ThreeOverlay({ viewport_camera_projection: camera, scene });
        viewport.addOverlay({ overlay });
        setOverlay(overlay);

        return () => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport, camera]);

    return <ThreeOverlayContext.Provider value={{ overlay }}>{children}</ThreeOverlayContext.Provider>;
}

//------------------------------------------------------------------------------
export { ThreeOverlayProvider as ThreeOverlay };

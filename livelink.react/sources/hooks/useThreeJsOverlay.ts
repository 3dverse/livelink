//------------------------------------------------------------------------------
import { useEffect, useMemo } from "react";
import * as THREE from "three";

//------------------------------------------------------------------------------
import { Livelink, Viewport, RenderingSurface } from "@3dverse/livelink";
import { ThreeJS_Overlay } from "@3dverse/livelink-three";

//------------------------------------------------------------------------------
type View = { enable_threejs?: boolean };

//------------------------------------------------------------------------------
export function useThreeJsOverlay({ instance, views }: { instance: Livelink | null; views: Array<View> }): {
    /**
     * The scene that is being rendered by the ThreeJS overlay.
     * Tied to the Livelink instance. If the instance is destroyed, the scene is destroyed.
     */
    scene: THREE.Scene | null;
} {
    const scene = useMemo(() => (instance ? new THREE.Scene() : null), [instance]);

    useEffect(() => {
        if (!instance || !scene) {
            return;
        }

        const overlays = installOverlays({ scene, views, viewports: instance.viewports });
        return () => {
            for (const [surface, overlay] of overlays) {
                surface.removeOverlay({ overlay });
            }
        };
    }, [instance, scene]);

    return { scene };
}

//------------------------------------------------------------------------------
function installOverlays({
    scene,
    views,
    viewports,
}: {
    scene: THREE.Scene;
    views: Array<View>;
    viewports: Array<Viewport>;
}) {
    const overlays = new Map<RenderingSurface, ThreeJS_Overlay>();

    for (const i in views) {
        const view = views[i];
        const viewport = viewports[i];

        if (!view.enable_threejs) {
            continue;
        }

        const surface = viewport.rendering_surface as RenderingSurface;

        if (!overlays.has(surface)) {
            const overlay = new ThreeJS_Overlay({ canvas: surface.canvas, scene });
            surface.addOverlay({ overlay });
            overlays.set(surface, overlay);
        }

        const overlay = overlays.get(surface);
        overlay!.addViewport({ viewport });
    }

    return overlays;
}

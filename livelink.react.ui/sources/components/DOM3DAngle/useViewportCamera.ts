//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

//------------------------------------------------------------------------------
import type { OverlayInterface, Quat, Vec3, Viewport } from "@3dverse/livelink";
import { ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
export type ViewportCamera = {
    /** World position of the camera. */
    position: Vec3;
    /** World orientation of the camera. */
    orientation: Quat;
    /** Pixels on screen per world unit, at a distance of one world unit from the camera. */
    focalLengthPx: number;
};

/**
 * Position, orientation and focal length of the camera of the viewport, as it was when the frame on screen was
 * rendered: the camera `DOM3DOverlay` lays its elements out with. Null outside of a viewport.
 *
 * The camera entity itself runs ahead of the frame on screen, by the time the frame takes to come back from the
 * renderer: drawings computed from it would slide off the elements of `DOM3DOverlay` while the camera moves.
 */
export function useViewportCamera(): ViewportCamera | null {
    const { viewport } = useContext(ViewportContext);
    const [viewportCamera, setViewportCamera] = useState<ViewportCamera | null>(null);

    useEffect(() => {
        if (!viewport) {
            setViewportCamera(null);
            return;
        }

        let isActive = true;
        let latest: ViewportCamera | null = null;
        let isRenderScheduled = false;

        const update = (): void => {
            const next = readViewportCamera(viewport);
            if (isSameViewportCamera(latest, next)) {
                return;
            }
            latest = next;
            if (isRenderScheduled) {
                return;
            }
            // The viewport draws its overlays, and `DOM3DOverlay` moves its elements, synchronously: rendering right
            // after, once React is free to, before the browser paints, keeps the two on the same frame.
            isRenderScheduled = true;
            queueMicrotask(() => {
                isRenderScheduled = false;
                if (isActive) {
                    flushSync(() => setViewportCamera(latest));
                }
            });
        };

        // Drawn by the viewport at each frame, once its camera projection is the one of the frame.
        const frameListener: OverlayInterface = {
            draw: () => {
                update();
                return null;
            },
            resize: update,
            release: () => {},
        };
        viewport.addOverlay({ overlay: frameListener });
        update();

        return (): void => {
            isActive = false;
            viewport.removeOverlay({ overlay: frameListener });
        };
    }, [viewport]);

    return viewportCamera;
}

//------------------------------------------------------------------------------
function readViewportCamera(viewport: Viewport): ViewportCamera | null {
    const projection = viewport.camera_projection;
    if (!projection) {
        return null;
    }

    return {
        position: [...projection.world_position] as Vec3,
        orientation: [...projection.world_orientation] as Quat,
        // Same perspective as the one DOM3DOverlay sets up.
        focalLengthPx: (projection.clip_from_view_matrix[5] * viewport.dom_element.clientHeight) / 2,
    };
}

function isSameViewportCamera(a: ViewportCamera | null, b: ViewportCamera | null): boolean {
    if (!a || !b) {
        return a === b;
    }
    return (
        a.focalLengthPx === b.focalLengthPx &&
        a.position.every((value, index) => value === b.position[index]) &&
        a.orientation.every((value, index) => value === b.orientation[index])
    );
}

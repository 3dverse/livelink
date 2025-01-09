//------------------------------------------------------------------------------
import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { CameraController as DefaultCameraController, Entity, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { ViewportContext } from "./Viewport";

/**
 * Context that provides a camera controller.
 *
 * @category Context Providers
 */
export const CameraControllerContext = createContext<{
    cameraController: DefaultCameraController | null;
}>({
    cameraController: null,
});

/**
 * A component that provides a camera controller.
 *
 * @category Components
 */
export function CameraController({
    _preset = "orbital",
    children,
}: PropsWithChildren & { _preset?: "orbital" | "fly" }) {
    const { viewportDomElement, camera } = useContext(ViewportContext);
    const [cameraController, setCameraController] = useState<DefaultCameraController | null>(null);
    useEffect(() => {
        if (!viewportDomElement || !camera) {
            return;
        }

        const controller = new DefaultCameraController({
            camera_entity: camera.camera_entity,
            dom_element: viewportDomElement,
        });
        setCameraController(controller);

        return () => {
            controller.release();
            setCameraController(null);
        };
    }, [viewportDomElement, camera]);

    return <CameraControllerContext.Provider value={{ cameraController }}>{children}</CameraControllerContext.Provider>;
}

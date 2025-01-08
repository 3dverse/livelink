//------------------------------------------------------------------------------
import { useContext, useEffect } from "react";

//------------------------------------------------------------------------------
import { CameraController as DefaultCameraController, CameraControllerBase, Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { ViewportContext } from "./Viewport";

/**
 * A component that provides a camera controller.
 *
 * @category Components
 */
export function CameraController({
    controllerClass = DefaultCameraController,
}: {
    controllerClass?: {
        new (_: { camera_entity: Entity; dom_element: HTMLElement }): CameraControllerBase;
    };
}) {
    const { viewportDomElement, camera } = useContext(ViewportContext);

    useEffect(() => {
        if (!viewportDomElement || !camera) {
            return;
        }

        const controller = new controllerClass({
            dom_element: viewportDomElement,
            camera_entity: camera.camera_entity,
        });
        controller.activate();

        return () => {
            controller.deactivate();
            controller.release();
        };
    }, [viewportDomElement, camera]);

    return null;
}

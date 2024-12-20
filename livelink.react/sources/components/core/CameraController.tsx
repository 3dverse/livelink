//------------------------------------------------------------------------------
import { useContext, useEffect } from "react";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { ViewportContext } from "./Viewport";
import { DefaultCameraController } from "../../controllers/DefaultCameraController";

//------------------------------------------------------------------------------
export interface CameraControllerInterface {
    /**
     *
     */
    release(): void;
}

//------------------------------------------------------------------------------
/**
 *
 */
export function CameraController({
    controllerClass = DefaultCameraController,
}: {
    controllerClass?: {
        new (_: { camera_entity: Entity; dom_element: HTMLElement }): CameraControllerInterface;
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

        return () => {
            controller.release();
        };
    }, [viewportDomElement, camera]);

    return null;
}

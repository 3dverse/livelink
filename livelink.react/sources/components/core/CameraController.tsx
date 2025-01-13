//------------------------------------------------------------------------------
import React, {
    createContext,
    forwardRef,
    PropsWithChildren,
    Ref,
    useContext,
    useEffect,
    useImperativeHandle,
    useState,
} from "react";

//------------------------------------------------------------------------------
import { CameraController as DefaultCameraController } from "@3dverse/livelink";

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
export const CameraController = forwardRef(function CameraController(
    { _preset = "orbital", children }: PropsWithChildren & { _preset?: "orbital" | "fly" },
    ref: Ref<DefaultCameraController | null>,
) {
    const { viewportDomElement, camera } = useContext(ViewportContext);
    const [cameraController, setCameraController] = useState<DefaultCameraController | null>(null);
    useImperativeHandle(ref, () => cameraController, [cameraController]);

    useEffect(() => {
        if (!viewportDomElement || !camera) {
            return;
        }

        const controller = new DefaultCameraController({
            camera_entity: camera.camera_entity,
            dom_element: viewportDomElement,
        });
        setCameraController(controller);

        return (): void => {
            controller.release();
            setCameraController(null);
        };
    }, [viewportDomElement, camera]);

    return <CameraControllerContext.Provider value={{ cameraController }}>{children}</CameraControllerContext.Provider>;
});

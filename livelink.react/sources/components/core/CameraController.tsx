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
import {
    CameraController as DefaultCameraController,
    CameraControllerPresets,
    CameraControllerPreset,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { ViewportContext } from "./Viewport";

/**
 * Context that provides a camera controller.
 *
 * @category Context Providers
 */
export const CameraControllerContext = createContext<{
    cameraController: DefaultCameraController | undefined;
}>({
    cameraController: undefined,
});

/**
 * A component that provides a camera controller.
 *
 * @category Components
 */
export const CameraController = forwardRef(function CameraController(
    { preset = CameraControllerPresets.orbital, children }: PropsWithChildren & { preset?: CameraControllerPreset },
    ref: Ref<DefaultCameraController | undefined>,
) {
    const { viewport, camera } = useContext(ViewportContext);
    const [cameraController, setCameraController] = useState<DefaultCameraController | undefined>(undefined);
    useImperativeHandle(ref, () => cameraController, [cameraController]);

    useEffect(() => {
        if (!viewport || !camera) {
            return;
        }

        const controller = new DefaultCameraController({
            camera_entity: camera.camera_entity,
            viewport,
            preset,
        });

        setCameraController(controller);

        return (): void => {
            controller.release();
            setCameraController(undefined);
        };
    }, [viewport, camera, preset]);

    return <CameraControllerContext.Provider value={{ cameraController }}>{children}</CameraControllerContext.Provider>;
});

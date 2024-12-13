import React, { useEffect } from "react";
import { Camera, RelativeRect, UUID, Viewport } from "@3dverse/livelink";

import { LivelinkContext } from "./Livelink";
import { CanvasContext } from "./Canvas";
import { DefaultCamera } from "../../cameras/DefaultCamera";

//------------------------------------------------------------------------------
export const ViewportContext = React.createContext<{
    viewport: Viewport | null;
    cameraInstance: Camera | null;
    zIndex: number;
}>({
    viewport: null,
    cameraInstance: null,
    zIndex: 0,
});

//------------------------------------------------------------------------------
function ViewportProvider({
    children,
    rect = new RelativeRect({}),
    cameraType = DefaultCamera,
    cameraName = "MyCam",
}: React.PropsWithChildren<{
    rect?: RelativeRect;
    cameraType?: typeof Camera | UUID | null | (() => Promise<Camera | null>);
    cameraName?: string;
}>) {
    const { instance } = React.useContext(LivelinkContext);
    const { renderingSurface } = React.useContext(CanvasContext);
    const { zIndex: parentZIndex = 0 } = React.useContext(ViewportContext);

    const [cameraInstance, setCameraInstance] = React.useState<Camera | null>(null);
    const [viewport, setViewport] = React.useState<Viewport | null>(null);

    const zIndex = parentZIndex + 1;

    useEffect(() => {
        if (!instance || !renderingSurface) {
            return;
        }

        const viewport = new Viewport(instance, renderingSurface, { rect, z_index: zIndex });
        console.log("---- Setting viewport", viewport.width, viewport.height, zIndex);
        instance.addViewports({ viewports: [viewport] });
        setViewport(viewport);

        return () => {
            console.log("---- Removing viewport");
            instance.removeViewport({ viewport });
            viewport.release();
            setViewport(null);
        };
    }, [instance, renderingSurface, zIndex]);

    useEffect(() => {
        if (!instance || !viewport) {
            return;
        }

        let setCamera = true;
        const resolveCamera = async () => {
            if (cameraType === null) {
                return null;
            } else if (typeof cameraType === "string") {
                console.log("---- Finding camera");
                return await instance.scene.findEntity(Camera, { entity_uuid: cameraType as UUID });
            } else if (!(cameraType.prototype instanceof Camera)) {
                console.log("---- Creating camera using callback");
                return await (cameraType as () => Promise<Camera | null>)();
            } else {
                console.log("---- Creating camera");
                setCamera = false;
                return await instance.newCamera(cameraType as typeof Camera, cameraName, viewport);
            }
        };

        resolveCamera().then(cameraEntity => {
            console.log("---- Viewport ready");
            if (setCamera && cameraEntity) {
                cameraEntity.viewport = viewport;
                viewport.camera = cameraEntity;
            }

            setCameraInstance(cameraEntity);
            viewport.__markViewportAsReady();
        });
    }, [instance, cameraType, viewport]);

    return (
        <ViewportContext.Provider
            value={{
                viewport,
                cameraInstance,
                zIndex,
            }}
        >
            {children}
        </ViewportContext.Provider>
    );
}

//------------------------------------------------------------------------------
export { ViewportProvider as Viewport };

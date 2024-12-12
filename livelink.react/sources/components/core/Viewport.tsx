import React, { useEffect } from "react";
import { Camera, RelativeRect, UUID, Viewport } from "@3dverse/livelink";

import { LivelinkContext } from "./Livelink";
import { CanvasContext } from "./Canvas";
import { DefaultCamera } from "../../cameras/DefaultCamera";

//------------------------------------------------------------------------------
export const ViewportContext = React.createContext<{ viewport: Viewport | null; cameraInstance: Camera | null }>({
    viewport: null,
    cameraInstance: null,
});

//------------------------------------------------------------------------------
function ViewportProvider({
    children,
    rect = new RelativeRect({}),
    cameraType = DefaultCamera,
    cameraName = "MyCam",
}: React.PropsWithChildren<{ rect?: RelativeRect; cameraType?: typeof Camera | UUID | null; cameraName?: string }>) {
    const { instance } = React.useContext(LivelinkContext);
    const { renderingSurface } = React.useContext(CanvasContext);

    const [cameraInstance, setCameraInstance] = React.useState<Camera | null>(null);
    const [viewport, setViewport] = React.useState<Viewport | null>(null);

    useEffect(() => {
        if (!instance || !renderingSurface) {
            return;
        }

        const viewport = new Viewport(instance, renderingSurface, { rect });
        console.log("---- Setting viewport");
        instance.addViewports({ viewports: [viewport] });
        setViewport(viewport);

        return () => {
            console.log("---- Removing viewport");
            instance.removeViewport({ viewport });
            viewport.release();
            setViewport(null);
        };
    }, [instance, renderingSurface]);

    useEffect(() => {
        if (!instance || !viewport) {
            return;
        }

        const resolveCamera = async () => {
            if (cameraType === null) {
                return null;
            } else if (typeof cameraType === "string") {
                console.log("---- Finding camera");
                const cameraEntity = await instance.scene.findEntity(Camera, { entity_uuid: cameraType as UUID });
                if (cameraEntity) {
                    cameraEntity.viewport = viewport;
                    viewport.camera = cameraEntity;
                }
                return cameraEntity;
            } else {
                console.log("---- Creating camera");
                return await instance.newCamera(cameraType, cameraName, viewport);
            }
        };

        resolveCamera().then(cameraEntity => {
            setCameraInstance(cameraEntity);
            console.log("---- Viewport ready");
            viewport.markViewportAsReady();
        });
    }, [instance, cameraType, viewport]);

    return (
        <ViewportContext.Provider
            value={{
                viewport,
                cameraInstance,
            }}
        >
            {children}
        </ViewportContext.Provider>
    );
}

//------------------------------------------------------------------------------
export { ViewportProvider as Viewport };

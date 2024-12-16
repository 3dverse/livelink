//------------------------------------------------------------------------------
import React, { useEffect } from "react";

//------------------------------------------------------------------------------
import { Camera, RelativeRect, UUID, Viewport } from "@3dverse/livelink";
import * as Livelink from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { DefaultCamera } from "../../cameras/DefaultCamera";
import { ViewportContext } from "./Viewport";

//------------------------------------------------------------------------------
export const CameraContext = React.createContext<{ cameraInstance: Livelink.Camera | null }>({ cameraInstance: null });

//------------------------------------------------------------------------------
export type CameraType =
    | { id: UUID }
    | { class: typeof Livelink.Camera; name: string }
    | { finder: () => Promise<Livelink.Camera | null> };

//------------------------------------------------------------------------------
function CameraProvider(cameraType: CameraType) {
    const { instance } = React.useContext(LivelinkContext);
    const { viewport, viewportDomElement } = React.useContext(ViewportContext);

    //const [cameraInstance, setCameraInstance] = React.useState<Camera | null>(null);

    useEffect(() => {
        if (!instance || !viewport) {
            return;
        }

        let setCamera = true;
        const resolveCamera = async () => {
            if ("id" in cameraType) {
                console.log("---- Finding camera with id", cameraType.id);
                return await instance.scene.findEntity(Camera, { entity_uuid: cameraType.id });
            } else if ("class" in cameraType) {
                console.log("---- Creating camera");
                setCamera = false;
                return await instance.newCamera(cameraType.class, cameraType.name, viewport);
            } else {
                return await cameraType.finder();
            }
        };

        resolveCamera().then(cameraEntity => {
            console.log("---- Viewport ready");
            if (setCamera && cameraEntity) {
                cameraEntity.viewport = viewport;
                viewport.camera = cameraEntity;
            }

            //setCameraInstance(cameraEntity);
            if (viewportDomElement && cameraEntity instanceof DefaultCamera) {
                cameraEntity._initController({ domElement: viewportDomElement });
            }
            viewport.__markViewportAsReady();
        });
    }, [instance, cameraType, viewport]);

    return null;
}

//------------------------------------------------------------------------------
export { CameraProvider as Camera };

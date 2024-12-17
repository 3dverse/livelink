//------------------------------------------------------------------------------
import { createContext, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { UUID } from "@3dverse/livelink";
import * as Livelink from "@3dverse/livelink";
import { Livelink as LivelinkInstance } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";
import { DefaultCamera } from "../../cameras/DefaultCamera";
import { ViewportContext } from "./Viewport";

/**
 *
 */
export const CameraContext = createContext<{ cameraInstance: Livelink.Camera | null }>({ cameraInstance: null });

export type CameraId = { id: UUID };
export type CameraClass = { class: typeof Livelink.Camera; name: string };
export type CameraFinder = {
    finder: ({ instance }: { instance: LivelinkInstance }) => Promise<Livelink.Camera | null>;
};
export type ClientCamera = { client: Livelink.Client; index?: number };
/**
 *
 */
export type CameraProvider = CameraId | CameraClass | CameraFinder | ClientCamera;

/**
 *
 */
export function Camera(cameraProvider: CameraProvider) {
    const { instance } = useContext(LivelinkContext);
    const { viewport, viewportDomElement } = useContext(ViewportContext);

    const [cameraInstance, setCameraInstance] = useState<Livelink.Camera | null>(null);

    const cameraId = cameraProvider as CameraId;
    const cameraClass = cameraProvider as CameraClass;
    const cameraFinder = cameraProvider as CameraFinder;
    const clientCamera = cameraProvider as ClientCamera;

    useEffect(() => {
        if (!instance || !viewport) {
            return;
        }

        let setCamera = true;
        const resolveCamera = async () => {
            if ("id" in cameraProvider) {
                console.debug("---- Finding camera with id", cameraProvider.id);
                return await instance.scene.findEntity(Livelink.Camera, { entity_uuid: cameraProvider.id });
            } else if ("class" in cameraProvider) {
                console.debug("---- Creating camera");
                setCamera = false;
                return await instance.newCamera(cameraProvider.class, cameraProvider.name, viewport);
            } else if ("finder" in cameraProvider) {
                return await cameraProvider.finder({ instance });
            } else {
                return (await instance.scene.getEntity({
                    entity_rtid: cameraProvider.client.camera_rtids[cameraProvider.index ?? 0],
                })) as Livelink.Camera;
            }
        };

        resolveCamera().then(cameraEntity => {
            console.debug("---- Viewport ready");
            if (setCamera && cameraEntity) {
                cameraEntity.viewport = viewport;
                viewport.camera = cameraEntity;
            }

            setCameraInstance(cameraEntity);
            viewport.__markViewportAsReady();
        });
    }, [
        instance,
        cameraId.id,
        cameraClass.class,
        cameraClass.name,
        cameraFinder.finder,
        clientCamera.client,
        clientCamera.index,
        viewport,
    ]);

    useEffect(() => {
        if (viewportDomElement && cameraInstance instanceof DefaultCamera) {
            cameraInstance._initController({ domElement: viewportDomElement });
        }
    }, [viewportDomElement, cameraInstance]);

    return null;
}

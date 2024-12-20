//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    type Livelink as LivelinkInstance,
    Camera as LivelinkCamera,
    Entity,
    Gamepad,
    Keyboard,
    Mouse,
} from "@3dverse/livelink";
import { LivelinkContext, Livelink, Viewport, ViewportContext, Canvas, useEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const characterControllerSceneUUID = "55e9d2cc-27c8-43e0-b014-0363be83de55";

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Third Person Controller",
    summary: "A character controller via a third person camera setup.",
    autoConnect: false,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink sceneId={scene_id} token={token} LoadingPanel={LoadingSpinner}>
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { instance } = useContext(LivelinkContext);

    const instantiatePlayerSceneAndFindThirdPersonCamera = useCallback(
        async ({ instance }: { instance: LivelinkInstance }): Promise<Entity | null> => {
            if (!instance) {
                return null;
            }

            const playerSceneEntity = await instance.scene.newEntity(
                "PlayerSceneEntity",
                { local_transform: [0, 0, 0], scene_ref: { value: characterControllerSceneUUID } },
                {
                    delete_on_client_disconnection: true,
                },
            );

            const children = await playerSceneEntity.getChildren();
            const thirdPersonController = children.find(child => child.script_map !== undefined);
            const thirdPersonCameraEntity = children.find(child => child.camera !== undefined);

            console.log("Assigning client to scripts");
            if (thirdPersonController && instance.session.client_id) {
                thirdPersonController.assignClientToScripts({ client_uuid: instance.session.client_id });
            }

            setStartSimulation(true);

            return thirdPersonCameraEntity ?? null;
        },
        [instance],
    );

    const { entity: cameraEntity } = useEntity({ finder: instantiatePlayerSceneAndFindThirdPersonCamera });
    const [startSimulation, setStartSimulation] = useState<boolean>(false);

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                {startSimulation && <SimulationStarter />}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function SimulationStarter() {
    const { instance } = useContext(LivelinkContext);
    const { viewportDomElement } = useContext(ViewportContext);

    useEffect(() => {
        if (!instance || !viewportDomElement) {
            return;
        }

        console.log("Setting up controller");

        viewportDomElement.requestPointerLock();

        instance.addInputDevice(Keyboard);
        instance.addInputDevice(Gamepad);
        instance.addInputDevice(Mouse, viewportDomElement);

        instance.startSimulation();
    }, [instance, viewportDomElement]);

    return null;
}

//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    type Livelink as LivelinkInstance,
    type Entity,
    Gamepad,
    Keyboard,
    Mouse,
} from "@3dverse/livelink";
import {
    LivelinkContext,
    Livelink,
    Viewport,
    ViewportContext,
    Canvas,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const characterControllerSceneUUID = "55e9d2cc-27c8-43e0-b014-0363be83de55";

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Third Person Controller",
    summary: "A character controller via a third person camera setup.",
    autoConnect: false,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { instance } = useContext(LivelinkContext);

    useEffect(() => {
        if (!instance) {
            return;
        }

        async function instantiatePlayerSceneAndFindThirdPersonCamera(
            instance: LivelinkInstance,
        ) {
            const playerSceneEntity = await instance.scene.newEntity({
                name: "PlayerSceneEntity",
                components: {
                    local_transform: { position: [0, 0, 0] },
                    scene_ref: { value: characterControllerSceneUUID },
                },
                options: {
                    delete_on_client_disconnection: true,
                },
            });

            const children = await playerSceneEntity.getChildren();
            const thirdPersonController = children.find(
                child => child.script_map !== undefined,
            );
            const thirdPersonCameraEntity = children.find(
                child => child.camera !== undefined,
            );

            console.log("Assigning client to scripts");
            if (thirdPersonController && instance.session.client_id) {
                thirdPersonController.assignClientToScripts({
                    client_uuid: instance.session.client_id,
                });
            }

            setStartSimulation(true);

            setCameraEntity(thirdPersonCameraEntity ?? null);
        }
        instantiatePlayerSceneAndFindThirdPersonCamera(instance);
    }, [instance]);

    const [startSimulation, setStartSimulation] = useState<boolean>(false);
    const [cameraEntity, setCameraEntity] = useState<Entity | null>(null);

    return (
        <Canvas className="w-full h-full">
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

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
import { LivelinkContext, Livelink, Viewport, ViewportContext, Canvas, Camera } from "@3dverse/livelink-react";

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
class TPController extends Entity {
    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 0, 0] };
        this.scene_ref = { value: characterControllerSceneUUID };
    }
}

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink sceneId={scene_id} token={token} LoadingPanel={LoadingSpinner}>
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Controller />
                </Viewport>
            </Canvas>
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function Controller() {
    const { instance } = useContext(LivelinkContext);
    const { viewportDomElement } = useContext(ViewportContext);

    const [startSimulation, setStartSimulation] = useState<boolean>(false);

    const instantiatePlayerSceneAndFindThirdPersonCamera = useCallback(
        async ({ instance }: { instance: LivelinkInstance }) => {
            if (!instance) {
                return null;
            }

            const playerSceneEntity = await instance.scene.newEntity(TPController, "PlayerSceneEntity", {
                delete_on_client_disconnection: true,
            });

            const children = await playerSceneEntity.getChildren();
            const thirdPersonController = children.find(child => child.script_map !== undefined);
            const thirdPersonCameraEntity = children.find(child => child.camera !== undefined);

            console.log("Assigning client to scripts");
            if (thirdPersonController && instance.session.client_id) {
                thirdPersonController.assignClientToScripts({ client_uuid: instance.session.client_id });
            }

            setStartSimulation(true);

            return thirdPersonCameraEntity as LivelinkCamera;
        },
        [instance],
    );

    useEffect(() => {
        if (!startSimulation || !instance || !viewportDomElement) {
            return;
        }

        console.log("Setting up controller");

        viewportDomElement.requestPointerLock();

        instance.addInputDevice(Keyboard);
        instance.addInputDevice(Gamepad);
        instance.addInputDevice(Mouse, viewportDomElement);

        instance.startSimulation();
    }, [startSimulation, instance, viewportDomElement]);

    return <Camera finder={instantiatePlayerSceneAndFindThirdPersonCamera} />;
}

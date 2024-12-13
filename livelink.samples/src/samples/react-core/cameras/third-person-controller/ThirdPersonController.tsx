//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useState } from "react";
import { type Livelink as LivelinkInstance, Camera, Entity, Gamepad, Keyboard, Mouse } from "@3dverse/livelink";
import { CanvasContext, LivelinkContext, Livelink, Viewport, ViewportContext } from "@3dverse/livelink-react";

import { SamplePlayer } from "../../../../components/Player";
import { LoadingSpinner } from "../../../../styles/components/LoadingSpinner";
import { StyledCanvas } from "../../../../styles/components/Canvas";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const characterControllerSceneUUID = "55e9d2cc-27c8-43e0-b014-0363be83de55";

//------------------------------------------------------------------------------
class TPController extends Entity {
    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 0, 0] };
        this.scene_ref = { value: characterControllerSceneUUID };
    }
}

//------------------------------------------------------------------------------
export default function ThirdPersonController() {
    return (
        <div className="relative h-full p-3 lg:pl-0">
            <SamplePlayer>
                <Livelink scene_id={scene_id} token={token} loader={<LoadingSpinner />}>
                    <App />
                </Livelink>
            </SamplePlayer>
        </div>
    );
}

//------------------------------------------------------------------------------
function App() {
    const { instance, isConnecting } = useContext(LivelinkContext);
    const [thirdPersonController, setThirdPersonController] = useState<Entity | undefined>(undefined);

    const setupFirstPersonCamera = useCallback(async () => {
        if (!instance || !instance.session.client_id) {
            return null;
        }

        const playerSceneEntity = await instance.scene.newEntity(TPController, "PlayerSceneEntity", {
            delete_on_client_disconnection: true,
        });

        const children = await playerSceneEntity.getChildren();
        const thirdPersonController = children.find(child => child.script_map !== undefined);
        const thirdPersonCameraEntity = children.find(child => child.camera !== undefined);
        setThirdPersonController(thirdPersonController);

        return thirdPersonCameraEntity as Camera;
    }, [instance]);

    return (
        <StyledCanvas>
            <Viewport cameraType={setupFirstPersonCamera}>
                {thirdPersonController && instance && !isConnecting && (
                    <Controller instance={instance} thirdPersonController={thirdPersonController} />
                )}
            </Viewport>
        </StyledCanvas>
    );
}

//------------------------------------------------------------------------------
function Controller({
    instance,
    thirdPersonController,
}: {
    instance: LivelinkInstance;
    thirdPersonController: Entity;
}) {
    const { canvas } = useContext(CanvasContext);
    const { viewport } = useContext(ViewportContext);

    useEffect(() => {
        if (!canvas || !viewport) {
            return;
        }

        if (!instance.session.client_id) {
            return;
        }

        console.log("Setting up controller");

        //canvas.requestPointerLock();

        instance.addInputDevice(Keyboard);
        instance.addInputDevice(Gamepad);
        instance.addInputDevice(Mouse, viewport);

        console.log("Assigning client to scripts");
        thirdPersonController.assignClientToScripts({ client_uuid: instance.session.client_id });

        instance.startSimulation();
    }, [canvas, viewport, instance]);

    return null;
}

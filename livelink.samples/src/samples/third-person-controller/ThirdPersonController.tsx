//------------------------------------------------------------------------------
import { useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Camera, Entity, Livelink, Keyboard } from "@3dverse/livelink";

const manifest = {
    charCtlSceneUUID: "a8b0086e-f89b-43fd-8e8e-2a5188fe3056",
};

class FPController extends Entity {
    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 0, 0] };
        this.scene_ref = { value: manifest.charCtlSceneUUID, maxRecursionCount: 1 };
    }
}

//------------------------------------------------------------------------------
export default function ThirdPersonController() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef, camera: null }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "5bd6f2b0-183f-4a63-a720-293b575fc439", token: "public_p54ra95AMAnZdTel" }).then(
                async (v: { instance: Livelink } | null) => {
                    const instance = v?.instance;

                    if (!instance || !instance.session.client_id || instance.viewports.length === 0) return;

                    const playerSceneEntity = await instance.scene.newEntity(FPController, "PlayerSceneEntity");
                    const children = await playerSceneEntity.getChildren();
                    const firstPersonController = children.find(child => child.script_map !== undefined);
                    const firstPersonCameraEntity = children.find(child => child.camera !== undefined);
                    const viewport = instance.viewports[0];
                    if (firstPersonController && firstPersonCameraEntity) {
                        const firstPersonCamera = firstPersonCameraEntity as Camera;
                        viewport.camera = firstPersonCamera;
                        firstPersonController.assignClientToScripts({ client_uuid: instance.session.client_id });
                        instance.startSimulation();
                        instance.addInputDevice(Keyboard);
                    }
                },
            );
        }
    };

    return (
        <div className="relative h-full p-3">
            <Canvas canvasRef={canvasRef} />
            <div
                className={`absolute ${instance ? "top-6 left-6" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}
            >
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </div>
        </div>
    );
}

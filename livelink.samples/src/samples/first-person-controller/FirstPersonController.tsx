//------------------------------------------------------------------------------
import { useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Camera, Entity, Livelink } from "@3dverse/livelink";

const manifest = {
    charCtlSceneUUID: "3bf25e2f-f38d-44f1-a932-c60b9aae0985",
};

class FPController extends Entity {
    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 0, 0] };
        this.scene_ref = { value: manifest.charCtlSceneUUID, maxRecursionCount: 1 };
    }
}

//------------------------------------------------------------------------------
export default function FirstPersonController() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef, camera: null }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "f408b7c1-4a98-4aa2-b490-009232607616", token: "public_qywgE6ratPJlLQ0l" }).then(
                async (v: { instance: Livelink } | null) => {
                    const instance = v?.instance;

                    if (!instance || !instance.session.client_id) return;

                    const playerSceneEntity = await instance.scene.newEntity(FPController, "PlayerSceneEntity");
                    const firstPersonController = (await playerSceneEntity.getChildren())[0];
                    const children = await firstPersonController.getChildren();
                    const firstPersonCameraEntity = children.find(child => child.camera !== undefined);
                    const viewport = instance.viewports[0];
                    if (viewport && firstPersonCameraEntity) {
                        const firstPersonCamera = firstPersonCameraEntity as Camera;
                        viewport.camera = firstPersonCamera;
                        firstPersonController.assignClientToScripts({ client_uuid: instance.session.client_id });
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

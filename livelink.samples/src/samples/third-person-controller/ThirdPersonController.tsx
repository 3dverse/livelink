//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { Camera, Entity, Keyboard, Mouse, Livelink, UUID, Viewport } from "@3dverse/livelink";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

const manifest = {
    charCtlSceneUUID: "a8b0086e-f89b-43fd-8e8e-2a5188fe3056",
} as const;

class TPController extends Entity {
    onCreate() {
        this.auto_broadcast = "off";
        this.local_transform = { position: [0, 0, 0] };
        this.scene_ref = { value: manifest.charCtlSceneUUID, maxRecursionCount: 1 };
    }
}

//------------------------------------------------------------------------------
export default function ThirdPersonController() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [player, setPlayer] = useState<TPController | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const [mode, setMode] = useState<"fly" | "thirdPerson">("thirdPerson");

    const flyCameraRef = useRef<Camera | null>(null);
    const thirdPersonCameraRef = useRef<Camera | null>(null);

    async function setupController(instance: Livelink, viewport: Viewport, client_uuid: UUID) {
        const playerSceneEntity = await instance.scene.newEntity(TPController, "PlayerSceneEntity", {
            delete_on_client_disconnection: true,
        });
        const children = await playerSceneEntity.getChildren();
        const firstPersonController = children.find(child => child.script_map !== undefined);
        const firstPersonCameraEntity = children.find(child => child.camera !== undefined);
        if (firstPersonController && firstPersonCameraEntity) {
            const firstPersonCamera = firstPersonCameraEntity as Camera;
            viewport.camera = firstPersonCamera;
            thirdPersonCameraRef.current = firstPersonCamera;
            firstPersonController.assignClientToScripts({ client_uuid });
            instance.startSimulation();
        }
        setPlayer(playerSceneEntity);
    }

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "5bd6f2b0-183f-4a63-a720-293b575fc439", token: "public_p54ra95AMAnZdTel" }).then(
                async (v: { instance: Livelink } | null) => {
                    const instance = v?.instance;
                    if (!instance || !instance.session.client_id || instance.viewports.length === 0) return;
                    const viewport = instance.viewports[0];
                    flyCameraRef.current = viewport.camera;
                    instance.addInputDevice(Keyboard);
                    instance.addInputDevice(Mouse, viewport);
                    setupController(instance, viewport, instance.session.client_id);
                },
            );
        }
    };

    const toggleCamera = () => {
        if (!instance) return;
        const viewport = instance.viewports[0];
        setMode(mode => {
            if (mode === "fly" && thirdPersonCameraRef.current) {
                viewport.camera = thirdPersonCameraRef.current;
            }
            if (mode === "thirdPerson" && flyCameraRef.current) {
                viewport.camera = flyCameraRef.current;
            }
            return mode === "fly" ? "thirdPerson" : "fly";
        });
    };

    useEffect(() => {
        return () => {
            if (instance) {
                setPlayer(null);
            }
        };
    }, [instance, player]);

    return (
        <div className="relative h-full p-3 pl-0">
            <Canvas canvasRef={canvasRef} />
            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                {instance && (
                    <button className="button button-primary" onClick={toggleCamera}>
                        {mode === "fly" ? "Switch to 3rd Person" : "Switch to Fly"}
                    </button>
                )}
            </CanvasActionBar>
        </div>
    );
}

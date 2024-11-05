//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import {
    Camera,
    Entity,
    Keyboard,
    Mouse,
    Gamepad,
    Livelink,
    UUID,
    Viewport,
    RenderingSurface,
} from "@3dverse/livelink";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
// https://console.3dverse.com/3dverse-templates/livelink-samples
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const manifest = {
    charCtlSceneUUID: "55e9d2cc-27c8-43e0-b014-0363be83de55",
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
            const canvas = (viewport.rendering_surface as RenderingSurface).canvas;
            const firstPersonCamera = firstPersonCameraEntity as Camera;
            firstPersonCamera.onAttach = () => {
                if (document.activeElement instanceof HTMLElement) {
                    // unfocus the toggle button, otherwise once the user press the space bar to jump, the toggle button
                    // gets pressed and the user goes back to fly mode.
                    document.activeElement.blur();
                }
                canvas.requestPointerLock();
            };
            firstPersonCamera.onDetach = () => {
                canvas.ownerDocument.exitPointerLock();
            };
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
            connect({ scene_id, token }).then(async (v: { instance: Livelink } | null) => {
                const instance = v?.instance;
                if (!instance || !instance.session.client_id || instance.viewports.length === 0) return;
                const viewport = instance.viewports[0];
                flyCameraRef.current = viewport.camera;
                instance.addInputDevice(Keyboard);
                instance.addInputDevice(Gamepad);
                instance.addInputDevice(Mouse, viewport);
                setupController(instance, viewport, instance.session.client_id);
            });
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
        <div className="relative h-full p-3 lg:pl-0">
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

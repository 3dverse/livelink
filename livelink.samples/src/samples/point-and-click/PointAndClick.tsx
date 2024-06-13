//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Camera, Entity, Vec3 } from "@3dverse/livelink";
import { DefaultCamera } from "../../components/DefaultCamera";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    Character: "209d5e32-8936-4b03-844e-ce8d4d9b194b",
    Ground: "da7d111b-1841-4190-b4de-b30754ec4ef8",
};

//------------------------------------------------------------------------------
export default function PointAndClick() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });
    const character = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Character" });
    const ground = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Ground" });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "4bb77a52-af61-446b-9000-269ab6d44516",
                token: "public_p54ra95AMAnZdTel",
                onConnected,
            });
        }
    };

    async function onConnected({ cameras }: { cameras: Array<Camera | null> }) {
        if (cameras.length === 0 || cameras[0] === null) {
            return;
        }

        const camera = cameras[0] as DefaultCamera;
        if (!camera.viewport || !camera.cameraControls) {
            return;
        }

        camera.viewport.activatePicking();
    }

    // Initialize ground position
    useEffect(() => {
        if (!ground) return;
        ground!.local_transform!.position = [0, 0.01, 0];
    }, [ground]);

    // On click on ground
    const onClick = useCallback((e: Event, _character: Entity) => {
        const event = e as CustomEvent<{ entity: Entity | null; ws_normal: Vec3; ws_position: Vec3 }>;
        const { entity, ws_position } = event.detail;
        if (entity?.debug_name?.value !== "Ground") return;
        _character!.local_transform!.position = [ws_position[0], 0.01, ws_position[2]];
    }, []);

    // Listen to click on the ground
    useEffect(() => {
        if (character) {
            instance!.viewports[0].addEventListener("on-entity-picked", e => onClick(e, character));
        }
    }, [instance, character, onClick]);

    // UI
    return (
        <div className="relative h-full p-3">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </div>
    );
}

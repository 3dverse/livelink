//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { Toggle } from "react-daisyui";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";
import { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    DirectionChanger: "a5bab943-615d-4db6-b5e5-f1c8ff6df10f",
};

const COLORS: [Vec3, Vec3] = [
    [1, 0, 0],
    [0, 1, 0],
] as const;

let i = 0;

//------------------------------------------------------------------------------
export default function ConveyorBelt() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const changer = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "DirectionChanger" });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "68b4c674-4727-46b1-9930-b7feae1d447f", token: "public_p54ra95AMAnZdTel" });
        }
    };

    useEffect(() => {
        if (instance) {
            instance.startSimulation();
        }
    }, [instance]);

    return (
        <>
            <div className="relative w-full h-full">
                <div className="w-full h-full p-4">
                    <Canvas canvasRef={canvasRef} />
                </div>
                <div className="absolute flex items-center gap-2 pb-4 p-4 w-full bottom-0 bg-color-ground bg-opacity-80">
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                    {changer && (
                        <Toggle
                            onChange={() => {
                                changer.physics_material!.contactVelocity![0] *= -1;
                                (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = COLORS[i++ % 2];
                            }}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

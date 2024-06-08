//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { Toggle } from "react-daisyui";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";
import { Camera, Livelink, Vec2, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    DirectionChanger: "a5bab943-615d-4db6-b5e5-f1c8ff6df10f",
    TriggerL: "cadefc48-3360-42aa-8b33-eba85c10a2ec",
    TriggerR: "01d1c785-0e23-4264-8393-e780c2a10df6",
    SensorL: "be7bd2e4-bb62-4042-bc53-dc7396dfeafa",
    SensorR: "9d4fc837-210d-4904-acb2-6f8553c59346",
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
    const triggerL = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "TriggerL" });
    const triggerR = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "TriggerR" });
    const sensorL = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "SensorL" });
    const sensorR = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "SensorR" });

    const onTriggerLEntered = useCallback(() => {
        if (!changer || !sensorL) return;
        changer.physics_material!.contactVelocity![0] = 1;
        (changer.material!.dataJSON! as { scale: Vec2 }).scale = [-1, 1];
        (changer.material!.dataJSON! as { speed: number }).speed = -2;
        (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = [0, 1, 0];
        (sensorL.material!.dataJSON! as { albedo: Vec3 }).albedo = [0, 1, 0];
    }, [changer, sensorL]);
    const onTriggerLExited = useCallback(() => {
        if (!sensorL) return;
        (sensorL.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 1, 1];
    }, [sensorL]);

    const onTriggerREntered = useCallback(() => {
        if (!changer || !sensorR) return;
        changer.physics_material!.contactVelocity![0] = -1;
        (changer.material!.dataJSON! as { scale: Vec2 }).scale = [1, 1];
        (changer.material!.dataJSON! as { speed: number }).speed = 2;
        (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 0, 0];
        (sensorR.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 0, 0];
    }, [changer, sensorR]);
    const onTriggerRExited = useCallback(() => {
        if (!sensorR) return;
        (sensorR.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 1, 1];
    }, [sensorR]);

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "68b4c674-4727-46b1-9930-b7feae1d447f", token: "public_p54ra95AMAnZdTel" }).then(
                (v: { instance: Livelink; cameras: Array<Camera | null> } | null) => {
                    if (v && v.cameras[0] !== null) {
                        const d = v.cameras[0].camera?.dataJSON as {
                            grid: boolean;
                            volumetricLighting: boolean;
                            bloom: boolean;
                            filterSpecular: boolean;
                            transparentGroundPlane: boolean;
                        };
                        d.grid = false;
                        d.filterSpecular = true;
                        d.transparentGroundPlane = true;
                    }
                },
            );
        }
    };

    useEffect(() => {
        if (instance) {
            instance.startSimulation();
        }
    }, [instance]);

    useEffect(() => {
        if (triggerL === null) {
            return;
        }
        triggerL.addEventListener("trigger-entered", onTriggerLEntered);
        triggerL.addEventListener("trigger-exited", onTriggerLExited);
        return () => {
            triggerL.removeEventListener("trigger-entered", onTriggerLEntered);
            triggerL.removeEventListener("trigger-exited", onTriggerLExited);
        };
    }, [triggerL, onTriggerLEntered, onTriggerLExited]);

    useEffect(() => {
        if (triggerR === null) {
            return;
        }
        triggerR.addEventListener("trigger-entered", onTriggerREntered);
        triggerR.addEventListener("trigger-exited", onTriggerRExited);
        return () => {
            triggerR.removeEventListener("trigger-entered", onTriggerREntered);
            triggerR.removeEventListener("trigger-exited", onTriggerRExited);
        };
    }, [triggerR, onTriggerREntered, onTriggerRExited]);

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

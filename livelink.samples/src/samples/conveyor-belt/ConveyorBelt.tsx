import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Entity, Livelink, Vec2, Vec3 } from "@3dverse/livelink";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, DefaultCamera, useEntity } from "@3dverse/livelink-react";
import { Output, OutputItem, OutputValue } from "../../styles/components/output";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest = {
    DirectionChanger: "a5bab943-615d-4db6-b5e5-f1c8ff6df10f",
    TriggerL: "cadefc48-3360-42aa-8b33-eba85c10a2ec",
    TriggerR: "01d1c785-0e23-4264-8393-e780c2a10df6",
    SensorL: "be7bd2e4-bb62-4042-bc53-dc7396dfeafa",
    SensorR: "9d4fc837-210d-4904-acb2-6f8553c59346",
    FallDetector: "49b2ddf9-94c6-4dfc-8350-7df64bd8e0eb",
} as const;

//------------------------------------------------------------------------------
export default function ConveyorBelt() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState([0, 0, 0]);
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const changer = useEntity({ instance, entity_uuid: SmartObjectManifest.DirectionChanger });
    const triggerL = useEntity({ instance, entity_uuid: SmartObjectManifest.TriggerL });
    const triggerR = useEntity({ instance, entity_uuid: SmartObjectManifest.TriggerR });
    const sensorL = useEntity({ instance, entity_uuid: SmartObjectManifest.SensorL });
    const sensorR = useEntity({ instance, entity_uuid: SmartObjectManifest.SensorR });
    const fallDetector = useEntity({ instance, entity_uuid: SmartObjectManifest.FallDetector });

    const onFallDetected = useCallback(() => {
        setScore(p => [p[0], p[1], p[2] + 1]);
    }, [setScore]);

    const onTriggerLEntered = useCallback(() => {
        if (!changer || !sensorL) return;
        changer.physics_material!.contactVelocity![0] = 1;
        (changer.material!.dataJSON! as { scale: Vec2 }).scale = [-1, 1];
        (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = [0, 1, 0];
        (sensorL.material!.dataJSON! as { albedo: Vec3 }).albedo = [0, 1, 0];

        setScore(p => [p[0] + 1, p[1], p[2]]);
    }, [changer, sensorL, setScore]);
    const onTriggerLExited = useCallback(() => {
        if (!sensorL) return;
        (sensorL.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 1, 1];
    }, [sensorL]);

    const onTriggerREntered = useCallback(() => {
        if (!changer || !sensorR) return;
        changer.physics_material!.contactVelocity![0] = -1;
        (changer.material!.dataJSON! as { scale: Vec2 }).scale = [1, 1];
        (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 0, 0];
        (sensorR.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 0, 0];
        setScore(p => [p[0], p[1] + 1, p[2]]);
    }, [changer, sensorR, setScore]);
    const onTriggerRExited = useCallback(() => {
        if (!sensorR) return;
        (sensorR.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 1, 1];
    }, [sensorR]);

    const onClick = useCallback(
        async (e: Event) => {
            const event = (e as CustomEvent<{ picked_entity: Entity | null }>).detail;
            setSelectedEntity(event?.picked_entity || null);
        },
        [setSelectedEntity],
    );

    function onConnected({ cameras }: { instance: Livelink; cameras: Array<Camera | null> }) {
        if (cameras.length === 0 || cameras[0] === null) {
            return;
        }

        const camera = cameras[0] as DefaultCamera;
        if (!camera.viewport || !camera.cameraControls) {
            return;
        }

        const d = camera.camera?.dataJSON as {
            grid: boolean;
            volumetricLighting: boolean;
            bloom: boolean;
            filterSpecular: boolean;
            transparentGroundPlane: boolean;
        };
        d.grid = false;
        d.filterSpecular = true;
        d.transparentGroundPlane = true;

        camera.cameraControls.setPosition(5, 3, 0);
        camera.viewport.activatePicking();
        camera.viewport.addEventListener("on-entity-picked", onClick);
    }

    const toggleConnection = async () => {
        if (instance) {
            instance.viewports[0].removeEventListener("on-entity-picked", onClick);
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "68b4c674-4727-46b1-9930-b7feae1d447f",
                token: "public_p54ra95AMAnZdTel",
                onConnected,
            });
        }
    };

    useEffect(() => {
        if (!instance) {
            return;
        }
        instance.startSimulation();
    }, [instance, onClick]);

    useEffect(() => {
        if (!triggerL) {
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
        if (!triggerR) {
            return;
        }
        triggerR.addEventListener("trigger-entered", onTriggerREntered);
        triggerR.addEventListener("trigger-exited", onTriggerRExited);
        return () => {
            triggerR.removeEventListener("trigger-entered", onTriggerREntered);
            triggerR.removeEventListener("trigger-exited", onTriggerRExited);
        };
    }, [triggerR, onTriggerREntered, onTriggerRExited]);

    useEffect(() => {
        if (!fallDetector) {
            return;
        }
        fallDetector.addEventListener("trigger-entered", onFallDetected);
        return () => {
            fallDetector.removeEventListener("trigger-entered", onFallDetected);
        };
    }, [fallDetector, onFallDetected]);

    useEffect(() => {
        if (changer) changer.auto_broadcast = "off";
        if (sensorL) sensorL.auto_broadcast = "off";
        if (sensorR) sensorR.auto_broadcast = "off";
    }, [changer, sensorL, sensorR]);

    return (
        <div className="relative w-full h-full">
            <div className="w-full h-full p-3 pl-0">
                <Canvas canvasRef={canvasRef} />
            </div>
            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
            {instance && (
                <Output>
                    <OutputItem>
                        Left
                        <OutputValue isNumber>{score[0]}</OutputValue>
                    </OutputItem>
                    <OutputItem>
                        Right
                        <OutputValue isNumber>{score[1]}</OutputValue>
                    </OutputItem>
                    <OutputItem>
                        Fallen Comrades
                        <OutputValue isNumber>{score[2]}</OutputValue>
                    </OutputItem>
                    {selectedEntity && (
                        <OutputItem>
                            Selected: <OutputValue className="capitalize">{selectedEntity.name}</OutputValue>
                        </OutputItem>
                    )}
                </Output>
            )}
        </div>
    );
}

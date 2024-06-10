//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";
import { Camera, Livelink, Vec2, Vec3 } from "@3dverse/livelink";
import { DefaultCamera } from "../../components/DefaultCamera";
import { Entity } from "@livelink.core";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    DirectionChanger: "6807984c-c682-422b-9a4e-ab2c26b60833",
    Trigger: "82f075ac-0b40-40c5-b570-b7421c3fb967",
    Sensor: "5c8659ec-ba10-4969-861d-26fe6c609176",
    FallDetector: "c5317ff8-0b3a-4275-a0d8-6eceba2c5edd",
};

//------------------------------------------------------------------------------
export default function ConveyorBeltSorting() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState([0, 0, 0]);
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const changer = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "DirectionChanger" });
    const trigger = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Trigger" });
    const sensor = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Sensor" });
    const fallDetector = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "FallDetector" });

    const onFallDetected = useCallback(() => {
        setScore(p => [p[0], p[1], p[2] + 1]);
    }, [setScore]);

    const onTriggerExited = useCallback(
        (e: Event) => {
            const event = e as CustomEvent<{ entity: Entity }>;
            const entity = event.detail.entity;
            if (!changer || !sensor) return;
            const color = (entity.material?.dataJSON as { albedo: Vec3 }).albedo;

            changer.physics_material!.contactVelocity![0] = color[0] > 0 ? -1 : 1;
            (changer.material!.dataJSON! as { scale: Vec2 }).scale = [
                -changer.physics_material!.contactVelocity![0],
                1,
            ];
            (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = color;
            (sensor.material!.dataJSON! as { albedo: Vec3 }).albedo = color;

            setScore(p => [p[0] + 1, p[1], p[2]]);
        },
        [changer, sensor, setScore],
    );
    const onTriggerEntered = useCallback(() => {
        if (!sensor) return;
        (sensor.material!.dataJSON! as { albedo: Vec3 }).albedo = [1, 1, 1];
    }, [sensor]);

    const onClick = useCallback(
        async (e: Event) => {
            const event = e as CustomEvent<{ picked_entity: Entity | null }>;
            setSelectedEntity(event.detail.picked_entity);
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
                scene_id: "4ab38fc9-1310-4071-a5ce-7da9914315a1",
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
        if (!trigger) {
            return;
        }
        trigger.addEventListener("trigger-entered", onTriggerEntered);
        trigger.addEventListener("trigger-exited", onTriggerExited);
        return () => {
            trigger.removeEventListener("trigger-entered", onTriggerEntered);
            trigger.removeEventListener("trigger-exited", onTriggerExited);
        };
    }, [trigger, onTriggerEntered, onTriggerExited]);

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
        if (sensor) sensor.auto_broadcast = "off";
    }, [changer, sensor]);

    return (
        <div className="relative w-full h-full">
            <div className="w-full h-full p-4">
                <Canvas canvasRef={canvasRef} />
            </div>
            <div className="absolute flex items-center gap-2 pb-4 p-4 w-full bottom-0 bg-color-ground bg-opacity-80">
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                <span>Left: {score[0]} | </span>
                <span>Right: {score[1]} | </span>
                <span>Fallen Comrades: {score[2]}</span>
                {selectedEntity && <span>| Selected: {selectedEntity.name}</span>}
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";
import { Camera, Entity, Livelink, Vec2, Vec3 } from "@3dverse/livelink";
import { DefaultCamera } from "../../components/DefaultCamera";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    DirectionChanger: "6807984c-c682-422b-9a4e-ab2c26b60833",
    Trigger: "82f075ac-0b40-40c5-b570-b7421c3fb967",
    Sensor: "5c8659ec-ba10-4969-861d-26fe6c609176",
    SensorLight: "570d40df-6162-4da5-a1ec-66b1ebed4d51",
    FallDetector: "c5317ff8-0b3a-4275-a0d8-6eceba2c5edd",
    Spawn1: "255cab6b-1824-4eae-9aae-705a1c47055a",
    Spawn2: "4378b417-058e-491b-a90c-b9eb547b558a",
};

let i = 0;

//------------------------------------------------------------------------------
export default function ConveyorBeltSorting() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState([0, 0, 0]);
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
    const packages: Array<Entity> = [];

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const changer = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "DirectionChanger" });
    const trigger = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Trigger" });
    const sensor = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Sensor" });
    const fallDetector = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "FallDetector" });
    const sensorLight = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "SensorLight" });
    const spawn1 = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Spawn1" });
    const spawn2 = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Spawn2" });

    const onFallDetected = useCallback(() => {
        setScore(p => [p[0], p[1], p[2] + 1]);
    }, [setScore]);

    const onTriggerExited = useCallback(
        (e: Event) => {
            const event = e as CustomEvent<{ entity: Entity }>;
            const entity = event.detail.entity;
            if (!changer || !sensor || !sensorLight) return;
            const color = (entity.material?.dataJSON as { albedo: Vec3 }).albedo;

            changer.physics_material!.contactVelocity![0] = color[0] > 0 ? -2 : 2;
            (changer.material!.dataJSON! as { scale: Vec2 }).scale = [
                -changer.physics_material!.contactVelocity![0],
                1,
            ];
            (changer.material!.dataJSON! as { albedo: Vec3 }).albedo = color;
            (sensor.material!.dataJSON! as { albedo: Vec3 }).albedo = [0.5, 0.5, 0.5];
            (sensor.material!.dataJSON! as { emission: Vec3 }).emission = [0, 0, 0];
            sensorLight.point_light!.color = [0, 0, 0];

            setScore(p => [p[0] + 1, p[1], p[2]]);
        },
        [changer, sensor, sensorLight, setScore],
    );
    const onTriggerEntered = useCallback(
        (e: Event) => {
            const event = e as CustomEvent<{ entity: Entity }>;
            const entity = event.detail.entity;
            if (!sensor || !sensorLight) return;
            const color = (entity.material?.dataJSON as { albedo: Vec3 }).albedo;
            (sensor.material!.dataJSON! as { albedo: Vec3 }).albedo = color;
            (sensor.material!.dataJSON! as { emission: Vec3 }).emission = color;
            sensorLight.point_light!.color = color;
        },
        [sensor, sensorLight],
    );

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
            skybox: boolean;
            bloomStrength: number;
            bloomThreshold: number;
            brightness: number;
            skyboxGrounded: boolean;
        };
        d.grid = false;
        d.filterSpecular = true;
        d.transparentGroundPlane = true;
        d.skybox = true;
        d.bloom = true;
        d.bloomStrength = 1;
        d.bloomThreshold = 1;
        d.brightness = 0.1;
        d.skyboxGrounded = true;

        camera.cameraControls.setPosition(5, 3, 0);
        camera.viewport.activatePicking();
        camera.viewport.addEventListener("on-entity-picked", onClick);
    }

    const toggleConnection = async () => {
        if (instance) {
            deletePackages();
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
        if (sensorLight) sensorLight.auto_broadcast = "off";
    }, [changer, sensor, sensorLight]);

    async function spawnPackage() {
        console.log(spawn1?.local_transform?.position);
        if (!instance || !spawn1) return;

        class Package extends Entity {
            onCreate() {
                const albedo = Math.floor(Math.random() * 2) == 0 ? [1, 0, 0] : [0, 1, 0];
                this.local_transform =
                    Math.floor(Math.random() * 2) == 0 ? spawn1!.local_transform : spawn2!.local_transform;
                this.local_transform!.scale = [0.5, 0.5, 0.5];
                this.mesh_ref = { value: "8adbbf0e-912e-41b1-b2d5-e70dabe28189" };
                this.material = { shaderRef: "744556b0-67b5-4329-ba4f-a04c04f92b1c", dataJSON: { albedo } };
                this.box_geometry = { dimension: [0.5, 0.5, 0.5], offset: [0.25, 0.25, 0.25] };
                this.physics_material = {};
                this.rigid_body = { mass: 100, centerOfMass: [0.25, 0.2, 0.25] };
            }
        }

        const p = await instance.scene.newEntity(Package, "MyPackage_" + i++);
        packages.push(p);
    }

    function deletePackages() {
        if (!instance) return;

        instance.scene.deleteEntities({ entities: packages });
    }

    return (
        <div className="relative w-full h-full">
            <div className="w-full h-full p-4">
                <Canvas canvasRef={canvasRef} />
            </div>
            <div className="absolute flex items-center gap-2 pb-4 p-4 w-full bottom-0 bg-color-ground bg-opacity-80">
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                {instance && (
                    <>
                        <button className="button button-primary" onClick={spawnPackage}>
                            Spawn
                        </button>
                        <button className="button button-primary" onClick={deletePackages}>
                            Reset
                        </button>
                        <span>Left: {score[0]} | </span>
                        <span>Right: {score[1]} | </span>
                        <span>Fallen Comrades: {score[2]}</span>
                        {selectedEntity && <span>| Selected: {selectedEntity.name}</span>}
                    </>
                )}
            </div>
        </div>
    );
}

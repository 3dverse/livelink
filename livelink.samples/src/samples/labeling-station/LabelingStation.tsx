//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Entity, Livelink } from "@3dverse/livelink";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { Manifest, useSmartObject } from "../../hooks/useSmartObject";
import Canvas from "../../components/Canvas";
import { DefaultCamera } from "../../components/DefaultCamera";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    Spawn: "448c4254-f965-4107-9f55-3fd9d95fdf0b",
    Despawn: "99d110d1-9f53-4640-8eb6-7a728022bfa3",
    LabelPrinter: "cbd366c8-22a2-4f54-8a8d-2afcf4aaf8ff",
    LabelingCB: "601962fe-1cb3-49b0-8b99-395a1eabb8dc",
    LabelingSensor: "38777c4c-9bc8-4759-93eb-d8148cab39a7",
    Barriers: "09c6e5d5-9619-42db-90d2-479b6d3ed50b",
};

let i = 0;
const packages: Array<Entity> = [];

//------------------------------------------------------------------------------
export default function LabelingStation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const spawn = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Spawn" });
    const despawn = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Despawn" });
    const printer = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "LabelPrinter" });
    const labelingCB = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "LabelingCB" });
    const labelingSensor = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "LabelingSensor" });
    const barriers = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "Barriers" });

    const onDespawn = useCallback(
        (e: Event) => {
            const event = e as CustomEvent<{ entity: Entity }>;
            const entity = event.detail.entity;
            instance?.scene.deleteEntities({ entities: [entity] });
        },
        [instance],
    );

    const onLabelingEntered = useCallback(() => {
        if (barriers) {
            barriers.local_transform!.position![1] = 0;
        }
    }, [barriers]);

    const onLabelingExited = useCallback(
        async (e: Event) => {
            if (!instance) return;

            const event = e as CustomEvent<{ entity: Entity }>;
            const entity = event.detail.entity;

            if (labelingCB) {
                labelingCB.physics_material!.contactVelocity = [0, 0, 0];
                labelingCB.material!.dataJSON!.speed = 0;
            }

            if (printer) {
                printer.local_transform!.position![2] = 0.2;

                class Label extends Entity {
                    onCreate() {
                        this.lineage = { parentUUID: entity.id! };
                        this.local_transform = {
                            position: [0.25, 0.25, 0.5],
                            orientation: [0.707, 0, 0, 0.707],
                            scale: [0.3, 0.01, 0.3],
                        };
                        this.decal_projector = {};
                        this.box_geometry = {};
                        this.material_ref = { value: "39494c28-d320-4f82-86c5-ae57b50613ea" };
                    }
                }
                await instance.scene.newEntity(Label, "Label_" + entity.name);
            }

            setTimeout(() => {
                if (barriers) {
                    barriers.local_transform!.position![1] = -0.2;
                }

                if (printer) {
                    printer.local_transform!.position![2] = 0.3;
                }

                if (labelingCB) {
                    const speed = 0.5;
                    labelingCB.physics_material!.contactVelocity = [speed, 0, 0];
                    labelingCB.material!.dataJSON!.speed = speed * 2;
                }
            }, 1000);
        },
        [instance, barriers, labelingCB, printer],
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
            decals: boolean;
        };
        d.grid = false;
        d.filterSpecular = true;
        d.transparentGroundPlane = true;
        d.skybox = true;
        d.bloom = true;
        d.bloomStrength = 1;
        d.bloomThreshold = 2;
        d.brightness = 0.5;
        d.skyboxGrounded = true;
        d.decals = true;

        camera.cameraControls.setPosition(5, 3, 0);
    }

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "9443e136-176e-4294-ab90-e7df3143c1e1",
                token: "public_p54ra95AMAnZdTel",
                onConnected,
            });
        }
    };

    useEffect(() => {
        if (!instance) {
            return;
        }
        if (barriers) barriers.auto_broadcast = "off";
        if (labelingCB) labelingCB.auto_broadcast = "off";
        if (printer) printer.auto_broadcast = "off";
        instance.startSimulation();
    }, [instance, barriers, labelingCB, printer]);

    useEffect(() => {
        if (!despawn) {
            return;
        }

        despawn.addEventListener("trigger-entered", onDespawn);
        return () => {
            despawn.removeEventListener("trigger-entered", onDespawn);
        };
    }, [despawn, onDespawn]);

    useEffect(() => {
        if (!labelingSensor) {
            return;
        }

        labelingSensor.addEventListener("trigger-entered", onLabelingEntered);
        labelingSensor.addEventListener("trigger-exited", onLabelingExited);
        return () => {
            labelingSensor.removeEventListener("trigger-entered", onLabelingEntered);
            labelingSensor.removeEventListener("trigger-exited", onLabelingExited);
        };
    }, [labelingSensor, onLabelingEntered, onLabelingExited]);

    async function spawnPackage() {
        if (!instance || !spawn) return;

        class Package extends Entity {
            onCreate() {
                const albedo = [42 / 255, 26 / 255, 7 / 255];
                this.local_transform = spawn!.local_transform;
                this.local_transform!.scale = [0.8, 0.8, 0.8];
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

    const [spawnInterval, setSpawnInterval] = useState(0);

    const toggleSpawner = () => {
        if (spawnInterval !== 0 || instance == null) {
            clearInterval(spawnInterval);
            setSpawnInterval(0);
            return;
        }

        const int = setInterval(() => {
            spawnPackage();
        }, 3500);

        setSpawnInterval(int);
    };

    useEffect(() => {
        return () => {
            clearInterval(spawnInterval);
        };
    });

    return (
        <div className="relative w-full h-full">
            <div className="w-full h-full p-4">
                <Canvas canvasRef={canvasRef} />
            </div>
            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                {instance && (
                    <>
                        <button className="button button-primary" onClick={toggleSpawner}>
                            {spawnInterval === 0 ? "Start" : "Stop"}
                        </button>
                        <button className="button button-primary" onClick={spawnPackage}>
                            Spawn
                        </button>
                    </>
                )}
            </CanvasActionBar>
        </div>
    );
}

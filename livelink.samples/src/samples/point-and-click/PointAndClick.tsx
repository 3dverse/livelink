//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef } from "react";
import { Camera, Entity, Vec3 } from "@3dverse/livelink";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, DefaultCamera, useEntity } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest = {
    Character: "209d5e32-8936-4b03-844e-ce8d4d9b194b",
    Ground: "da7d111b-1841-4190-b4de-b30754ec4ef8",
    Cube: "a17889ab-e6c1-47e8-860a-491948cf7158",
} as const;

//------------------------------------------------------------------------------
export default function PointAndClick() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });
    const character = useEntity({ instance, entity_uuid: SmartObjectManifest.Character });
    const ground = useEntity({ instance, entity_uuid: SmartObjectManifest.Ground });
    const cube = useEntity({ instance, entity_uuid: SmartObjectManifest.Cube });

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
    }, []);

    // On click on ground
    const onClick = useCallback((e: Event, _character: Entity) => {
        const event = e as CustomEvent<{ entity: Entity | null; ws_normal: Vec3; ws_position: Vec3 }>;
        if (!event.detail) return;
        const { entity, ws_position } = event.detail;
        if (entity?.debug_name?.value !== "Ground") return;

        const positionYIdle = 0.05;
        const initial = _character!.local_transform!.position || ([0, positionYIdle, 0] as Vec3);
        const destination = [ws_position[0], positionYIdle, ws_position[2]] as Vec3;

        let t = 0;
        const RATE = 12;
        const SPEED = 50; // m/ms
        const DISTANCE = distanceVector(initial, destination);
        const DURATION = DISTANCE * SPEED;

        const interval = setInterval(() => {
            // Calcul position
            const factor = Math.min(t / DURATION, 1);
            const x = lerp(initial[0], destination[0], factor);
            let y;
            if (factor <= 0.1) {
                y = lerp(positionYIdle, 1, Math.sin(factor * 10));
            } else if (factor >= 0.9) {
                y = lerp(1, positionYIdle, Math.cos((1 - factor) * 10));
            } else {
                y = 1;
            }
            const z = lerp(initial[2], destination[2], factor);

            // Set position
            _character!.local_transform!.position = [x, y, z];

            if (t >= DURATION) clearInterval(interval);
            else t += RATE;
        }, RATE);
    }, []);

    const lerp = (v0: number, v1: number, t: number) => {
        return v0 + t * (v1 - v0);
    };

    const distanceVector = (v1: Vec3, v2: Vec3) => {
        const dx = v1[0] - v2[0];
        const dy = v1[1] - v2[1];
        const dz = v1[2] - v2[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    // Listen to click on the ground
    useEffect(() => {
        if (character) {
            instance!.viewports[0].addEventListener("on-entity-picked", e => onClick(e, character));
        }
    }, [instance, character, onClick]);

    function toggleComponent() {
        if (!cube) return;

        if (cube.point_light) {
            delete cube.point_light;
        } else {
            cube.point_light = { color: [Math.random(), Math.random(), Math.random()], intensity: 1 };
        }
    }

    // UI
    return (
        <div className="relative h-full p-3 pl-0">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                {instance && (
                    <>
                        <button className="button button-primary" onClick={toggleComponent}>
                            {cube?.point_light ? "Detach" : "Attach"}
                        </button>
                    </>
                )}
            </CanvasActionBar>
        </div>
    );
}

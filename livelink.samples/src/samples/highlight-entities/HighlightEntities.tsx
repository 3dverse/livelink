//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Entity, Vec3 } from "@3dverse/livelink";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, DefaultCamera } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export default function HighlightEntities() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
    const [isVisible, setIsVisible] = useState(true);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({
                scene_id: "990665b9-df1c-4d45-aa85-72779aba5103",
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

    const spawnCube = useCallback(
        async function spawnCube(position: Vec3) {
            if (!instance) return;
            class Cube extends Entity {
                onCreate(): void {
                    this.mesh_ref = { value: "8adbbf0e-912e-41b1-b2d5-e70dabe28189" };
                    this.local_transform = { position };
                    this.material = { isDoubleSided: false, shaderRef: "744556b0-67b5-4329-ba4f-a04c04f92b1c" };
                }
            }
            await instance.scene.newEntity(Cube, "Cube");
        },
        [instance],
    );

    const onEntityClicked = useCallback(
        (e: Event) => {
            const event = e as CustomEvent<{ entity: Entity | null; ws_normal: Vec3; ws_position: Vec3 }>;
            if (!event.detail) return;

            const { entity, ws_position } = event.detail;

            if (entity?.debug_name?.value === "Ground") {
                spawnCube(ws_position);
            }

            if (entity?.debug_name?.value === "Cube") {
                setSelectedEntities(selected => {
                    if (selected.find(e => e.rtid === entity.rtid)) {
                        return selected.filter(e => e.rtid !== entity.rtid);
                    }
                    return [...selected, entity];
                });
            }
        },
        [spawnCube],
    );

    // Listen to click event
    useEffect(() => {
        if (!instance) return;
        instance.viewports[0].addEventListener("on-entity-picked", e => onEntityClicked(e));
    }, [instance, onEntityClicked]);

    // Update highlight on selection
    useEffect(() => {
        if (!instance) return;
        instance.scene.highlightEntities({ entities: selectedEntities });
    }, [instance, selectedEntities]);

    // UI
    return (
        <div className="relative h-full p-3">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                {instance && (
                    <>
                        <button
                            className="button button-primary"
                            onClick={() => {
                                if (!instance) return;
                                instance.scene.deleteEntities({ entities: selectedEntities });
                                setSelectedEntities([]);
                            }}
                        >
                            Delete {selectedEntities.length} {selectedEntities.length === 1 ? "entity" : "entities"}
                        </button>
                        <button
                            className="button button-primary"
                            onClick={() => {
                                if (!instance) return;
                                selectedEntities.forEach(entity => {
                                    entity.is_visible = !isVisible;
                                });
                                setIsVisible(!isVisible);
                            }}
                        >
                            {isVisible ? "Hide" : "Show"} {selectedEntities.length}{" "}
                            {selectedEntities.length === 1 ? "entity" : "entities"}
                        </button>
                    </>
                )}
            </CanvasActionBar>
        </div>
    );
}

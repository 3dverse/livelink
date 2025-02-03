//------------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    DefaultCameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import {
    ThreeOverlay,
    type TransformController,
    TransformControls,
} from "@3dverse/livelink-three/react";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "b49a55db-41ec-48ba-bddc-4f86a7f48602";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Three.js Transform Controls",
    summary:
        "An overlay with a three.js component to translate, rotate, and scale an entity.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            isTransient={true}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();
    const [pickedEntity, setPickedEntity] = useState<{
        entity: Entity;
    } | null>();
    const [isDragging, setDragging] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

    //--------------------------------------------------------------------------
    const cameraControllerRef = useRef<DefaultCameraController>(null);
    const transformControllerRef = useRef<TransformController>(null);

    //--------------------------------------------------------------------------
    const scene = useMemo(() => {
        const scene = new THREE.Scene();
        return scene;
    }, []);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!pickedEntity) {
            return;
        }

        setSelectedEntity(pickedEntity.entity);
    }, [pickedEntity]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        window.addEventListener("keydown", function (event) {
            const control = transformControllerRef.current;
            if (!control) {
                return;
            }

            switch (event.key) {
                case "q":
                    control.setSpace(
                        control.space === "local" ? "world" : "local",
                    );
                    break;

                case "Shift":
                    control.setTranslationSnap(1);
                    control.setRotationSnap(THREE.MathUtils.degToRad(15));
                    control.setScaleSnap(0.25);
                    break;

                case "w":
                    control.setMode("translate");
                    break;

                case "e":
                    control.setMode("rotate");
                    break;

                case "r":
                    control.setMode("scale");
                    break;

                case "+":
                case "=":
                    control.setSize(control.size + 0.1);
                    break;

                case "-":
                case "_":
                    control.setSize(Math.max(control.size - 0.1, 0.1));
                    break;

                case "x":
                    control.showX = !control.showX;
                    break;

                case "y":
                    control.showY = !control.showY;
                    break;

                case "z":
                    control.showZ = !control.showZ;
                    break;

                case "Escape":
                    setSelectedEntity(null);
                    break;
            }
        });
    }, []);

    return (
        <Canvas className="w-full h-full">
            <Viewport
                cameraEntity={cameraEntity}
                className="w-full h-full"
                setPickedEntity={!isDragging ? setPickedEntity : undefined}
            >
                <div>
                    <div className="absolute top-0 left-0 p-2 bg-ground">
                        "W" translate | "E" rotate | "R" scale | "+/-" adjust
                        size
                        <br />
                        "Q" toggle world/local space | "Shift" snap to grid
                        <br />
                        "X" toggle X | "Y" toggle Y | "Z" toggle Z
                        <br />
                        "Esc" clear selection
                    </div>
                </div>
                <CameraController ref={cameraControllerRef} />
                <ThreeOverlay scene={scene}>
                    <TransformControls
                        ref={transformControllerRef}
                        controlledEntity={selectedEntity}
                        cameraController={cameraControllerRef.current}
                        setDragging={setDragging}
                    />
                </ThreeOverlay>
            </Viewport>
        </Canvas>
    );
}

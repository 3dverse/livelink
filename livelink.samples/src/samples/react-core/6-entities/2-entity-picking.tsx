//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "a5dbe3a0-2056-48e7-a53e-3725cb770084";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Entity Picking",
    summary: "Shows how to enable entity picking.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
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
    const [pickedEntity, setPickedEntity] = useState<{ entity: Entity } | null>(
        null,
    );
    const [hoveredEntity, setHoveredEntity] = useState<{
        entity: Entity;
    } | null>(null);

    useEffect(() => {
        document.body.style.cursor = hoveredEntity ? "pointer" : "default";
    }, [hoveredEntity]);

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport
                    cameraEntity={cameraEntity}
                    setHoveredEntity={setHoveredEntity}
                    setPickedEntity={setPickedEntity}
                    className="w-full h-full"
                >
                    <CameraController />
                </Viewport>
            </Canvas>
            <EntityStatusPanel
                hoveredEntity={hoveredEntity?.entity ?? null}
                pickedEntity={pickedEntity?.entity ?? null}
            />
        </>
    );
}

//------------------------------------------------------------------------------
function EntityStatusPanel({
    hoveredEntity,
    pickedEntity,
}: {
    hoveredEntity: Entity | null;
    pickedEntity: Entity | null;
}) {
    return (
        <div className="absolute m-4 flex flex-col gap-4">
            <EntityPanel
                label="Hovered entity"
                color="bg-informative-500"
                entity={hoveredEntity}
            />
            <EntityPanel
                label="Picked entity"
                color="bg-positive-500"
                entity={pickedEntity}
            />
        </div>
    );
}

//------------------------------------------------------------------------------
function EntityPanel({
    label,
    entity,
    color,
}: {
    label: string;
    color: string;
    entity: Entity | null;
}) {
    return (
        <div>
            <span className="bg-ground p-2 rounded-xl rounded-r-none">
                {label}
            </span>
            <span
                className={`p-2 rounded-xl rounded-l-none text-primary-dark font-semibold ${entity ? color : "bg-negative-500"}`}
            >
                {entity ? entity.name : "none"}
            </span>
        </div>
    );
}

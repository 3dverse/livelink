//------------------------------------------------------------------------------
import { useCallback } from "react";

//------------------------------------------------------------------------------
import type { Entity } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    useEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "0c1b578d-081f-4da2-a434-e123d580fc0d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Entity Visibility",
    summary: "Shows how to toggle entity visibility.",
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

    const { entity: purpleBoxEntity } = useEntity({
        euid: "1d9fe508-98a5-41c0-8df3-03173c7401d7",
    });
    const { entity: orangeBoxEntity } = useEntity({
        euid: "aa574640-1267-47ed-820d-a858ba64f758",
    });
    const { entity: greenBoxEntity } = useEntity({
        euid: "112744e9-60a0-4e88-a37d-8a596033669c",
    });
    const { entity: childGreenBoxEntity } = useEntity({
        euid: "0cfa68a5-6e8c-45ef-90a8-03927fe64fb7",
    });
    const { entity: grandChildGreenBoxEntity } = useEntity({
        euid: "08b9a8c1-37a0-4656-8106-ae59be96b369",
    });

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                    <CameraController />
                </Viewport>
            </Canvas>
            <EntityVisibilityStatusPanel
                purpleBoxEntity={purpleBoxEntity}
                orangeBoxEntity={orangeBoxEntity}
                greenBoxEntity={greenBoxEntity}
                childGreenBoxEntity={childGreenBoxEntity}
                grandChildGreenBoxEntity={grandChildGreenBoxEntity}
            />
        </>
    );
}

//------------------------------------------------------------------------------
function EntityVisibilityStatusPanel({
    purpleBoxEntity,
    orangeBoxEntity,
    greenBoxEntity,
    childGreenBoxEntity,
    grandChildGreenBoxEntity,
}: {
    purpleBoxEntity: Entity | null;
    orangeBoxEntity: Entity | null;
    greenBoxEntity: Entity | null;
    childGreenBoxEntity: Entity | null;
    grandChildGreenBoxEntity: Entity | null;
}) {
    return (
        <div className="absolute flex flex-col gap-3 m-4">
            <EntityPanel color="#9b59b6" entity={purpleBoxEntity} />
            <EntityPanel color="#f39c12" entity={orangeBoxEntity} />
            <div className="flex flex-col gap-2">
                <EntityPanel color="#27ae60" entity={greenBoxEntity} />
                <EntityPanel
                    color="#27ae60"
                    entity={childGreenBoxEntity}
                    hierarchyLevel={2}
                />
                <EntityPanel
                    color="#27ae60"
                    entity={grandChildGreenBoxEntity}
                    hierarchyLevel={3}
                />
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
function EntityPanel({
    entity,
    color,
    hierarchyLevel = 0,
}: {
    color: string;
    entity: Entity | null;
    hierarchyLevel?: number;
}) {
    if (!entity) {
        return null;
    }

    const toggleVisibility = useCallback(() => {
        entity.is_visible = !entity.is_visible;
    }, [entity]);

    return (
        <div
            style={{
                opacity: entity.is_visible ? 1 : 0.5,
                transition: "opacity 0.3s",
                marginLeft: `${(hierarchyLevel || 0) * 20}px`,
            }}
            className="cursor-pointer flex items-center hover:opacity-100 transition-opacity"
            title={`Click to toggle visibility of ${entity.name}`}
            onClick={toggleVisibility}
        >
            <span
                className="px-3 py-1 rounded-lg rounded-r-none text-white font-semibold"
                style={{ backgroundColor: color }}
            >
                {entity ? entity.name : "none"}
            </span>
            <span className="px-3 py-1 rounded-lg rounded-l-none bg-ground">
                <input
                    type="checkbox"
                    checked={entity.is_visible}
                    readOnly
                    className="mr-2"
                />
                {entity.is_visible ? "Visible" : "Hidden"}
            </span>
        </div>
    );
}

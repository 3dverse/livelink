//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    LivelinkContext,
    ViewportContext,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";
import { useContext, useEffect, useState } from "react";
import { Entity, Mouse } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "a5dbe3a0-2056-48e7-a53e-3725cb770084";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
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
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <EntityPicker />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function EntityPicker() {
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP
    const { instance } = useContext(LivelinkContext);
    const { viewport, viewportDomElement } = useContext(ViewportContext);

    const [pickedEntity, setPickedEntity] = useState<Entity | null>(null);
    const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);

    useEffect(() => {
        if (!instance || !viewport || !viewportDomElement) {
            return;
        }

        instance.addInputDevice(Mouse, viewportDomElement);

        viewport.activatePicking({ dom_element: viewportDomElement });
        viewport.addEventListener("on-entity-picked", e => {
            const event = e as CustomEvent<{ entity: Entity } | null>;
            setPickedEntity(event.detail?.entity ?? null);

            instance.scene.highlightEntities({ entities: event.detail?.entity ? [event.detail.entity] : [] });
        });

        viewportDomElement.addEventListener("pointermove", async () => {
            viewportDomElement.style.cursor = instance.session.current_client?.cursor_data ? "pointer" : "default";
            setHoveredEntity((await instance.session.current_client?.getHoveredEntity()) ?? null);
        });
    }, [viewport, viewportDomElement]);
    //TEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMPTEMP

    return (
        <div className="absolute m-4 flex flex-col gap-4">
            <EntityPanel label="Hovered entity" color="bg-informative-500" entity={hoveredEntity} />
            <EntityPanel label="Picked entity" color="bg-positive-500" entity={pickedEntity} />
        </div>
    );
}

//------------------------------------------------------------------------------
function EntityPanel({ label, entity, color }: { label: string; color: string; entity: Entity | null }) {
    return (
        <div>
            <span className="bg-ground p-2 rounded-xl rounded-r-none">{label}</span>
            <span
                className={`p-2 rounded-xl rounded-l-none text-primary-dark font-semibold ${entity ? color : "bg-negative-500"}`}
            >
                {entity ? entity.name : "none"}
            </span>
        </div>
    );
}

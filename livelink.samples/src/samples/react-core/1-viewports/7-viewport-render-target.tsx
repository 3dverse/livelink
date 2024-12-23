//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    code: import.meta.env.VITE_FILE_CONTENT,
    title: "Viewport Render Target",
    summary: "Shows how to change the index of the displayed render target for a viewport.",
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
                <DebugViewports cameraEntity={cameraEntity} />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function DebugViewports({ cameraEntity }: { cameraEntity: Entity | null }) {
    const RENDER_TARGETS = [
        { index: 15, name: "View Space Normals" },
        { index: 24, name: "World Space Normals" },
        { index: 14, name: "View Space Positions" },
        { index: 17, name: "World Space Positions" },
    ] as const;

    return (
        <div className="absolute flex h-full flex-col gap-2 top-4 left-4 w-1/5">
            {RENDER_TARGETS.map(({ index, name }) => (
                <Viewport
                    key={index}
                    cameraEntity={cameraEntity}
                    renderTargetIndex={index}
                    title={name}
                    className=" aspect-video border border-tertiary"
                ></Viewport>
            ))}
        </div>
    );
}

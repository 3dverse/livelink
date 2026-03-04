//------------------------------------------------------------------------------
import { useState } from "react";
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
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
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

    return (
        <Canvas className="max-h-screen">
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
        { index: 0, name: "View Space Positions" },
        { index: 1, name: "View Space Normals" },
        { index: 3, name: "World Space Positions" },
        { index: 4, name: "World Space Normals" },
    ] as const;

    const [selectedRenderTarget, setRenderTarget] = useState(0);

    return (
        <>
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
            <div className="absolute bottom-4 right-4">
                <Viewport
                    cameraEntity={cameraEntity}
                    renderTargetIndex={selectedRenderTarget}
                    className="aspect-video border-2 border-secondary"
                ></Viewport>
                <select
                    className="select select-primary text-xs"
                    value={selectedRenderTarget}
                    onChange={event =>
                        setRenderTarget(Number.parseInt(event.target.value))
                    }
                >
                    {RENDER_TARGETS.map(item => (
                        <option key={item.index} value={item.index}>
                            {item.name}
                        </option>
                    ))}
                </select>
            </div>
        </>
    );
}

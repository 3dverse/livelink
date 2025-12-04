//------------------------------------------------------------------------------
import { useState } from "react";
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
import { ScaleSelector } from "@/components/common/ScaleSelector";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
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
    const [scale, setScale] = useState(1);

    return (
        <>
            <Canvas className="max-h-screen" scale={scale}>
                <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                    <CameraController />
                </Viewport>
            </Canvas>
            <div className="absolute bottom-2 m-4">
                <ScaleSelector scale={scale} setScale={setScale} />
            </div>
        </>
    );
}

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DAnchor,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { DOM3DAnchorLegend, LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

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

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    <DOM3DAnchor worldPosition={[2, 1.5, 0]} scaleFactor={0.005}>
                        <DOM3DAnchorLegend>North wing</DOM3DAnchorLegend>
                    </DOM3DAnchor>
                    <DOM3DAnchor worldPosition={[-2, 0.5, 1]} scaleFactor={0.005}>
                        <DOM3DAnchorLegend direction="end" color="#fbbf24">
                            Entry plaza
                        </DOM3DAnchorLegend>
                    </DOM3DAnchor>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

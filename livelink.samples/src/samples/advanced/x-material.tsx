//------------------------------------------------------------------------------
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
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "8b3117e2-127a-491f-b64e-5ec56ad81842";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Material",
    summary: "Modify materials.",
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
    const { entity: cube } = useEntity(
        { euid: "10a72212-2c07-41d1-b746-45e0a2cb4211" },
        ["material"],
    );

    return (
        <Canvas className="max-h-screen">
            {cube && cube.material && (
                <ThresholdSlider material={cube.material.dataJSON} />
            )}
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
type MaterialInterface = {
    threshold?: number;
};

//------------------------------------------------------------------------------
function ThresholdSlider({ material }: { material: MaterialInterface }) {
    const threshold = material.threshold ?? 0;

    return (
        <div className="absolute top-2 left-2 p-2 bg-ground rounded shadow">
            <label className="flex flex-col gap-2">
                Threshold: {threshold.toFixed(2)}
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={threshold}
                    onChange={e =>
                        (material.threshold = parseFloat(e.target.value))
                    }
                />
            </label>
        </div>
    );
}

//------------------------------------------------------------------------------
import { useEffect } from "react";
import { useControls } from "leva";

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
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "8b3117e2-127a-491f-b64e-5ec56ad81842";
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
    const { entity: cube } = useEntity(
        { euid: "10a72212-2c07-41d1-b746-45e0a2cb4211" },
        ["material"],
    );

    return (
        <Canvas className="max-h-screen">
            {cube && cube.material && (
                <ThresholdControl material={cube.material.dataJSON} />
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
function ThresholdControl({ material }: { material: MaterialInterface }) {
    const threshold = material.threshold ?? 0;

    const [, setControls] = useControls(
        () => ({
            threshold: {
                value: threshold,
                min: 0,
                max: 1,
                step: 0.01,
                // Called when the material moves the slider too: only a drag
                // writes to it.
                onChange: (value: number, _path, { fromPanel }) => {
                    if (fromPanel) material.threshold = value;
                },
            },
        }),
        [material],
    );

    // The slider follows the material, which other clients can change too.
    useEffect(() => {
        setControls({ threshold });
    }, [threshold, setControls]);

    return null;
}

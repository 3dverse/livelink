//------------------------------------------------------------------------------
import { useEffect } from "react";

//------------------------------------------------------------------------------
import { Entity } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Custom Controller",
    summary: "Shows how to create a custom camera controller.",
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
    const { cameraEntity } = useCameraEntity({ position: [0, 0, 10] });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CustomController cameraEntity={cameraEntity} />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function CustomController({ cameraEntity }: { cameraEntity: Entity | null }) {
    useEffect(() => {
        if (!cameraEntity) {
            return;
        }

        const interval = setInterval(() => {
            cameraEntity.local_transform!.position[1] =
                Math.cos(Date.now() * 0.001) * 5;
        }, 1000 / 60);

        return () => {
            clearInterval(interval);
        };
    }, [cameraEntity]);

    return null;
}

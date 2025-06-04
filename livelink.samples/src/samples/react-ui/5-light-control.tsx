//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    CameraController,
    useEntity,
} from "@3dverse/livelink-react";
import { LightControl, LoadingOverlay } from "@3dverse/livelink-react-ui";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "4a5ed051-d3c7-444d-9049-ce752af9748d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Light Control",
    summary: "A widget that lets you control the light",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            token={token}
            sceneId={scene_id}
            isTransient={true}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({
        settings: {
            ssr: true,
            volumetricLighting: true,
            density: 0.5,
        },
    });

    //--------------------------------------------------------------------------
    // Effects
    const { entity: light } = useEntity(
        { euid: "2716ab00-fc8a-4535-ac4f-8560962ba780" },
        ["point_light"],
    );

    //--------------------------------------------------------------------------
    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                {light && <LightControlWidget light={light} />}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function LightControlWidget({ light }: { light: Entity }) {
    return (
        <div
            className={`absolute bottom-16 right-16
                bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)]
                backdrop-blur-xl rounded-lg shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)]
            `}
        >
            <LightControl light={light} />
        </div>
    );
}

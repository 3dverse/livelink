//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    useEntity,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay, SunPositionPicker } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "bfadafe7-7d75-4e8d-ba55-3b65c4b1d994";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Sun Position Picker",
    summary: "A widget that lets you modify the sun position",
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
        settings: { atmosphere: true, gradient: false },
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <SunWidget />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
const SUN_ENTITY_ID = "23e6b1cc-5e04-42c4-b179-12447556a170" as const;

//------------------------------------------------------------------------------
function SunWidget() {
    const { isPending, entity: theSun } = useEntity({ euid: SUN_ENTITY_ID });

    if (!isPending && !theSun) {
        console.error("There's no sun entity in the scene");
        return null;
    }

    return (
        <div
            className={`absolute bottom-16 right-16 pb-2
                bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)]
                backdrop-blur-xl rounded-md shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)]
            `}
        >
            <SunPositionPicker sun={theSun} />
        </div>
    );
}

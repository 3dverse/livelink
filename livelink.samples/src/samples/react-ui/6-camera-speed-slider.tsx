//------------------------------------------------------------------------------
import { useState } from "react";
import { CameraControllerPresets } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    CameraController,
    DefaultCameraController,
} from "@3dverse/livelink-react";
import { CameraSpeedSlider, LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "4a5ed051-d3c7-444d-9049-ce752af9748d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Camera Speed Slider",
    summary: "A widget that lets you control the camera speed",
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
    const [cameraController, setCameraController] =
        useState<DefaultCameraController | null>();

    //--------------------------------------------------------------------------
    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController
                    ref={ref => setCameraController(ref)}
                    preset={CameraControllerPresets.fly}
                />
                {cameraController && (
                    <div
                        className={`absolute bottom-[5vh] left-1/2 -translate-x-1/2
                                bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)]
                                backdrop-blur-xl rounded-lg shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)]
                            `}
                    >
                        <CameraSpeedSlider
                            cameraController={cameraController}
                        />
                    </div>
                )}
            </Viewport>
        </Canvas>
    );
}

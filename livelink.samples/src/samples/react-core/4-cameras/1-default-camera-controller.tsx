//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";
import { useRef, useState } from "react";
import {
    CameraControllerPresets,
    CameraControllerPreset,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Default Controller",
    summary:
        "Shows how to create a default camera controller and get a reference to it.",
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
    const cameraControllerRef = useRef<DefaultCameraController>(null);
    const [cameraControllerPreset, setCameraControllerPreset] =
        useState<CameraControllerPreset>(CameraControllerPresets.orbital);

    const presetKeys = Object.keys(
        CameraControllerPresets,
    ) as (keyof typeof CameraControllerPresets)[];

    const moveCamera = () => {
        const targetPosition = [5, 0, 0] as const;
        const lookAtPosition = [0, 0, 0] as const;
        cameraControllerRef.current?.setLookAt(
            ...targetPosition,
            ...lookAtPosition,
            true,
        );
    };

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                    <CameraController
                        ref={cameraControllerRef}
                        preset={cameraControllerPreset}
                    />
                </Viewport>
            </Canvas>
            <div className="absolute top-14 left-1 flex flex-col">
                <div className="flex flex-row">
                    <button
                        className="button button-overlay mr-2"
                        onClick={moveCamera}
                    >
                        Move Camera
                    </button>
                    {presetKeys.map((presetKey, index) => {
                        const preset = CameraControllerPresets[presetKey];
                        const name = presetKey.replaceAll("_", " ");
                        const isCurrentPreset =
                            preset === cameraControllerPreset;
                        return (
                            <button
                                key={index}
                                className={`button button-overlay mr-2 ${isCurrentPreset ? "bg-accent" : ""}`}
                                onClick={() =>
                                    setCameraControllerPreset(preset)
                                }
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    useCameraEntity,
    useSceneSettings,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";
import { useCallback, useRef, useState } from "react";
import {
    CameraControllerPresets,
    CameraControllerPreset,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
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
    const cameraControllerRef = useRef<DefaultCameraController>(null);
    const [cameraControllerPreset, setCameraControllerPreset] =
        useState<CameraControllerPreset>(CameraControllerPresets.orbital);
    const { sceneSettings } = useSceneSettings();

    const presetKeys = Object.keys(
        CameraControllerPresets,
    ) as (keyof typeof CameraControllerPresets)[];

    // Move the camera to the default position and look at the origin
    const moveCamera = useCallback(() => {
        const targetPosition = sceneSettings
            ? ([...sceneSettings.default_camera_transform.position] as const)
            : ([5, 0, 0] as const);
        const lookAtPosition = [0, 0, 0] as const;
        cameraControllerRef.current?.setLookAt(
            ...targetPosition,
            ...lookAtPosition,
            true,
        );
    }, [sceneSettings]);

    // Override some properties of the preset to make it more suitable for this sample scene
    const overridenPreset = { ...cameraControllerPreset };
    if (cameraControllerPreset === CameraControllerPresets.fly) {
        // Increase the truck speed for the fly preset to make it more responsive on this scene.
        // Real use case could adjust this value based on user preferences or scene bounding box.
        overridenPreset.truckSpeed! *= 10;
    }

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                    <CameraController
                        ref={cameraControllerRef}
                        preset={overridenPreset}
                    />
                </Viewport>
            </Canvas>
            <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2 flex flex-row gap-1 w-max">
                <button
                    className="button button-overlay mr-4"
                    onClick={moveCamera}
                >
                    Reset position
                </button>
                {presetKeys.map((presetKey, index) => {
                    let preset = CameraControllerPresets[presetKey];
                    const name = presetKey.replaceAll("_", " ");
                    const isSelected = preset.id === cameraControllerPreset.id;
                    const selectPreset = () => {
                        if (presetKey === "orbital") {
                            // clone to avoid mutating the original preset
                            preset = {
                                ...preset,
                                init_options: {
                                    ...preset.init_options,
                                },
                            };
                            // Remove the initial target for the orbital preset to not "jump" back the orbit
                            // target to world origin.
                            delete preset.init_options?.target;
                        }
                        setCameraControllerPreset(preset);
                    };
                    return (
                        <button
                            key={index}
                            className={`button button-overlay capitalize ${isSelected ? "bg-accent" : ""}`}
                            onClick={selectPreset}
                        >
                            {name}
                        </button>
                    );
                })}
            </div>
        </>
    );
}

//------------------------------------------------------------------------------
import {
    Livelink,
    LivelinkContext,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    DOM3DOverlay,
    DOMEntity,
    useCameraEntity,
} from "@3dverse/livelink-react";
import type {
    Entity,
    Vec3,
    Quat,
    CameraControllerPreset,
} from "@3dverse/livelink";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "cc2997ec-8bb4-4c67-9aec-786bfe135518";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Camera Travel",
    summary:
        "Shows how to implement a simple camera travel system using labels defined in the scene.",
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
    const { instance } = useContext(LivelinkContext);
    const { cameraEntity } = useCameraEntity({ position: [50, 100, -50] });
    const [labels, setLabels] = useState<Entity[]>([]);
    const cameraControllerRef = useRef<DefaultCameraController>(null);
    const cameraPreset = useMemo<CameraControllerPreset>(
        () => ({ init_options: { target: [50, 0, 35] } }),
        [],
    );

    const moveCamera = (entity: Entity) => {
        if (!cameraControllerRef.current) {
            return;
        }

        const cameraController = cameraControllerRef.current;

        const labelComponent = entity.label;
        if (!labelComponent) {
            console.warn(`Entity ${entity.debug_name?.value} is not a label`);
            return;
        }

        // Extract camera pov from label component
        const position = labelComponent.camera.slice(0, 3) as Vec3;
        const orientation = labelComponent.camera.slice(3, 7) as Quat;

        const distance = cameraController.getTargetDistance();
        const forward = applyQuaternionToVector3(neutralForward, orientation);
        const scaledForward = forward.map(v => v * distance) as Vec3;
        const target = addVec3(position, scaledForward);

        // Move the camera to the position and look at the target
        cameraController.setLookAt(...position, ...target, true);
    };

    useEffect(() => {
        if (!instance) {
            return;
        }
        instance.scene
            .findEntitiesWithComponents({ mandatory_components: ["label"] })
            .then(entities => {
                console.debug("---- Found labels", entities);
                setLabels(entities);
            });
    }, [instance]);

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                    <CameraController
                        ref={cameraControllerRef}
                        preset={cameraPreset}
                    />

                    <DOM3DOverlay>
                        {labels.map(label => (
                            <DOMEntity
                                key={label.name}
                                entity={label}
                                anchor="center"
                            >
                                <div
                                    className="bg-underground border p-2 rounded-lg select-none cursor-pointer hover:scale-105 transition-transform "
                                    onClick={() => moveCamera(label)}
                                    title="Click to move camera here"
                                >
                                    {label.name}
                                </div>
                            </DOMEntity>
                        ))}
                    </DOM3DOverlay>
                </Viewport>
            </Canvas>
        </>
    );
}

//------------------------------------------------------------------------------
const neutralForward = [0, 0, -1] as Vec3;

//------------------------------------------------------------------------------
// Helper functions to perform vector and quaternion math without external libraries
function applyQuaternionToVector3(v: Vec3, q: Quat): Vec3 {
    // Quaternion rotation: v' = q * v * q^-1
    const [x, y, z] = v;
    const [qx, qy, qz, qw] = q;

    // Calculate quat * vector
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // Calculate result * inverse quat
    return [
        ix * qw + iw * -qx + iy * -qz - iz * -qy,
        iy * qw + iw * -qy + iz * -qx - ix * -qz,
        iz * qw + iw * -qz + ix * -qy - iy * -qx,
    ];
}

//------------------------------------------------------------------------------
function addVec3(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

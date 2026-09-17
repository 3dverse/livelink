//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    DOM3DOverlay,
    DOM3DEntityAnchor,
    useCameraEntity,
    useLabelPointsOfView,
    usePointOfViewSnapshots,
    type LabelPointOfView,
} from "@3dverse/livelink-react";
import type { Vec3, Quat, CameraControllerPreset } from "@3dverse/livelink";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { useMemo, useRef, type RefObject } from "react";
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "cc2997ec-8bb4-4c67-9aec-786bfe135518";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
            isTransient={true}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({ position: [50, 100, -50] });

    const cameraControllerRef = useRef<DefaultCameraController>(null);
    const cameraPreset = useMemo<CameraControllerPreset>(
        () => ({ init_options: { target: [50, 0, 35] } }),
        [],
    );

    return (
        <Canvas className="w-full h-full" data-theme="light">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController
                    ref={cameraControllerRef}
                    preset={cameraPreset}
                />

                <PointsOfView cameraControllerRef={cameraControllerRef} />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
// Lists every label's point of view as a clickable thumbnail, automatically snapshotted from
// an offscreen camera, and lets the user fly the main camera to any of them.
function PointsOfView({
    cameraControllerRef,
}: {
    cameraControllerRef: RefObject<DefaultCameraController | null>;
}) {
    const { pointsOfView } = useLabelPointsOfView();
    const { images } = usePointOfViewSnapshots(pointsOfView);

    const moveCamera = (pointOfView: LabelPointOfView) => {
        if (!cameraControllerRef.current) {
            return;
        }

        const cameraController = cameraControllerRef.current;
        const { position, orientation } = pointOfView;

        const distance = cameraController.distance;
        const forward = applyQuaternionToVector3(neutralForward, orientation);
        const scaledForward = forward.map(v => v * distance) as Vec3;
        const target = addVec3(position, scaledForward);

        // Move the camera to the position and look at the target
        cameraController.setLookAt(...position, ...target, true);
    };

    return (
        <>
            {/* Local keyframes: guaranteed to exist wherever this component renders, unlike
                Tailwind's animate-pulse which depends on the utility being generated/loaded. */}
            <style>{`
                @keyframes poi-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>

            {/* Points of view carousel - floating dock at the bottom of the viewport */}
            <div className="absolute left-1/2 bottom-4 z-10 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-2xl border border-white/40 bg-white/20 p-2 shadow-lg backdrop-blur-2xl scrollbar-none snap-x snap-mandatory">
                {pointsOfView.map((pointOfView, index) => (
                    <button
                        key={pointOfView.entity.id}
                        className="flex w-28 shrink-0 snap-center cursor-pointer flex-col items-center gap-1"
                        onClick={() => moveCamera(pointOfView)}
                        title={pointOfView.title || "Unnamed Label"}
                    >
                        <div className="h-20 w-28 overflow-hidden rounded-xl bg-gray-200 transition-transform hover:scale-105">
                            {images[index] ? (
                                <img
                                    src={images[index]}
                                    alt={pointOfView.title}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div
                                    className="h-full w-full"
                                    style={{
                                        backgroundColor: "#e5e7eb",
                                        backgroundImage:
                                            "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
                                        backgroundSize: "200% 100%",
                                        backgroundRepeat: "no-repeat",
                                        animation:
                                            "poi-shimmer 1.4s ease-in-out infinite",
                                    }}
                                />
                            )}
                        </div>
                        <span className="max-w-full truncate rounded-full border border-white/40 bg-white/60 px-2 py-0.5 text-2xs font-medium text-primary-dark backdrop-blur-3xl">
                            {pointOfView.title || "Unnamed Label"}
                        </span>
                    </button>
                ))}
            </div>

            <DOM3DOverlay>
                {pointsOfView.map(pointOfView => (
                    <DOM3DEntityAnchor
                        key={pointOfView.entity.id}
                        entity={pointOfView.entity}
                        offset="center"
                    >
                        <div
                            className="px-3 py-1 text-xs text-primary-dark font-medium bg-white/60 border border-white/40 backdrop-blur-3xl rounded-full select-none cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => moveCamera(pointOfView)}
                            title="Click to move camera here"
                        >
                            {pointOfView.title || "Unnamed Label"}
                        </div>
                    </DOM3DEntityAnchor>
                ))}
            </DOM3DOverlay>
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

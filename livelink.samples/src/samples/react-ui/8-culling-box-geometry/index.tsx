//------------------------------------------------------------------------------
import { useState } from "react";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import {
    CullingBoxGeometry,
    CullingBoxGeometryButton,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "5c19522d-a045-4554-a6d3-78bd87e44b86";
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
    const { cameraEntity } = useCameraEntity({
        position: [20, 20, 20],
        eulerOrientation: [-45, 45, 0],
    });

    const [enableCullingBoxGeometry, setEnableCullingBoxGeometry] =
        useState(true);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <div className="absolute bottom-[5vh] left-[5vh]">
                    <button
                        className="button button-primary px-4 py-2 cursor-pointer"
                        onClick={() =>
                            setEnableCullingBoxGeometry(
                                !enableCullingBoxGeometry,
                            )
                        }
                    >
                        {enableCullingBoxGeometry ? "Disable" : "Enable"} Box
                        Geometry
                    </button>
                </div>

                {enableCullingBoxGeometry && (
                    <CullingBoxGeometry initialSize={[20, 10, 20]}>
                        <div className="absolute bottom-[5vh] right-[5vh]">
                            <CullingBoxGeometryButton>
                                {({ toggle, isActive }) => (
                                    <button
                                        className="button button-primary px-4 py-2 cursor-pointer"
                                        onClick={toggle}
                                    >
                                        {isActive ? "Hide" : "Show"} Box
                                        Geometry
                                    </button>
                                )}
                            </CullingBoxGeometryButton>
                        </div>
                    </CullingBoxGeometry>
                )}
            </Viewport>
        </Canvas>
    );
}

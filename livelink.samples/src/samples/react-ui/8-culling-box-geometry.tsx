//------------------------------------------------------------------------------
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
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "5c19522d-a045-4554-a6d3-78bd87e44b86";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Culling Box Geometry",
    summary:
        "Three.js overlay with a widget to resize a box geometry that culls scene objects.",
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
    const { cameraEntity } = useCameraEntity({
        position: [20, 20, 20],
        eulerOrientation: [-45, 45, 0],
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <CullingBoxGeometry initialSize={[20, 10, 20]}>
                    <div
                        style={{
                            position: "absolute",
                            bottom: "4rem",
                            left: "50%",
                            translate: "-50% 0",
                        }}
                    >
                        <CullingBoxGeometryButton>
                            {({ toggle, isActive }) => (
                                <button
                                    className="button button-primary"
                                    style={{
                                        padding: "0.5rem 1rem",
                                        cursor: "pointer",
                                    }}
                                    onClick={toggle}
                                >
                                    {isActive ? "Hide" : "Show"} Box Geometry
                                </button>
                            )}
                        </CullingBoxGeometryButton>
                    </div>
                </CullingBoxGeometry>
            </Viewport>
        </Canvas>
    );
}

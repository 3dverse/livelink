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
import { DisconnectedModal } from "../../components/SamplePlayer";
import { Vec2, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "59705a36-56ed-49b3-b4fc-4b6cd69eb82c";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "MPR",
    summary: "MPR views for DICOM imaging.",
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
    return (
        <div className="flex basis-full p-2 gap-2 flex-row">
            <div className="flex basis-full gap-2 flex-col">
                <VoxelView />
                <MPRView position={[0, 0, 0.1]} eulerOrientation={[0, 0, 0]} />
            </div>
            <div className="flex basis-full gap-2 flex-col">
                <MPRView position={[0, 0.1, 0]} eulerOrientation={[90, 0, 0]} />
                <MPRView position={[0.1, 0, 0]} eulerOrientation={[0, 90, 0]} />
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
function VoxelView() {
    const { cameraEntity } = useCameraEntity({
        position: [0, 0, 1.75],
        eulerOrientation: [90, 0, 0],
        settings: { voxelStepMultiplier: 0.5, displayBackground: false },
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function MPRView({
    position,
    eulerOrientation,
}: {
    position: Vec3;
    eulerOrientation: Vec3;
}) {
    const MPR_RENDERGRAPH_UUID = "deba68af-4bed-4fde-9058-8cacfabe7e9f";
    const orthographic_lens = {
        zoomFactor: [0.6, 0.6] as Vec2,
        zNear: 0,
        zFar: 100,
    };
    const { cameraEntity } = useCameraEntity({
        renderGraphRef: MPR_RENDERGRAPH_UUID,
        position,
        eulerOrientation,
        orthographic_lens,
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

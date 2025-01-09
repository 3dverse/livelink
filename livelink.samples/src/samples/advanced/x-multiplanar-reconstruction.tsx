//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, CameraController, useCameraEntity } from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal} from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "59705a36-56ed-49b3-b4fc-4b6cd69eb82c";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
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
    const { cameraEntity: cameraEntity1 } = useCameraEntity({
        position: [0, 0, 1.5],
        orientation: [0.924, 0.383, 0, 0],
        settings: { voxelMultiplier: 0.5, displayBackground: false },
    });
    const { cameraEntity: cameraEntity2 } = useCameraEntity({ renderGraphRef: "c57253bf-40f2-44f1-942f-cc55dacea4f5" });

    return (
        <div className="flex basis-full p-2 gap-2 flex-row">
            <div className="flex basis-full gap-2 flex-col">
                <Canvas className="w-full h-full">
                    <Viewport cameraEntity={cameraEntity1} className="w-full h-full">
                        <CameraController />
                    </Viewport>
                </Canvas>
                <Canvas className="w-full h-full">
                    <Viewport cameraEntity={cameraEntity2} className="w-full h-full">
                        <CameraController />
                    </Viewport>
                </Canvas>
            </div>
            <div className="flex basis-full gap-2 flex-col">
                <Canvas className="w-full h-full">
                    <Viewport cameraEntity={cameraEntity2} className="w-full h-full">
                        <CameraController />
                    </Viewport>
                </Canvas>
                <Canvas className="w-full h-full">
                    <Viewport cameraEntity={cameraEntity2} className="w-full h-full">
                        <CameraController />
                    </Viewport>
                </Canvas>
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    ViewportContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Camera Render Target",
    summary:
        "Shows how to change the index of the displayed render target for a camera.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <>
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <AppLayout />
            </Livelink>
        </>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <RenderTargetSelector />
            </Viewport>
        </Canvas>
    );
}
//------------------------------------------------------------------------------
function RenderTargetSelector() {
    const { viewport } = useContext(ViewportContext);
    const [selectedRenderTarget, setRenderTarget] = useState<number>(-1);
    const RENDER_TARGETS = [
        { index: -1, name: "Default" },
        { index: 15, name: "View Space Normals" },
        { index: 24, name: "World Space Normals" },
        { index: 14, name: "View Space Positions" },
        { index: 17, name: "World Space Positions" },
    ] as const;

    useEffect(() => {
        if (viewport && viewport.camera_projection) {
            viewport.camera_projection.camera_entity.camera!.renderTargetIndex =
                selectedRenderTarget;
        }
    }, [viewport, selectedRenderTarget]);

    return (
        <div className="absolute bottom-4 flex items-center w-full justify-center">
            <select
                className="select select-primary min-w-[20rem]"
                value={selectedRenderTarget}
                onChange={event =>
                    setRenderTarget(Number.parseInt(event.target.value))
                }
            >
                {RENDER_TARGETS.map(item => (
                    <option key={item.index} value={item.index}>
                        {item.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

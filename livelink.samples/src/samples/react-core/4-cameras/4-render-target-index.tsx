//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera, ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Render Target Index",
    summary: "Shows how to change the index of the displayed render target.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <>
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingSpinner}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <Canvas className={sampleCanvasClassName}>
                    <Viewport className="w-full h-full">
                        <Camera class={DefaultCamera} name={"MyCamera"} />
                        <RenderTargetSelector />
                    </Viewport>
                </Canvas>
            </Livelink>
        </>
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
        if (viewport && viewport.camera) {
            viewport.camera.camera!.renderTargetIndex = selectedRenderTarget;
        }
    }, [viewport, selectedRenderTarget]);

    return (
        <div className="absolute bottom-4 flex items-center w-full justify-center">
            <select
                className="select select-primary min-w-[20rem]"
                value={selectedRenderTarget}
                onChange={event => setRenderTarget(Number.parseInt(event.target.value))}
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

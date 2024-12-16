//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Multi-Viewports Double Canvas",
    summary: "Two canvases having two viewports each.",
    element: (
        <Livelink
            scene_id={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            disconnectedModal={<DisconnectedModal />}
        >
            <div className="flex basis-full">
                <Canvas className={sampleCanvasClassName}>
                    <Viewport rect={{ left: 0, top: 0, width: 1, height: 0.5 }} />
                    <Viewport rect={{ left: 0, top: 0.5, width: 1, height: 0.5 }} />
                </Canvas>
            </div>
            <div className="flex basis-full">
                <Canvas className={sampleCanvasClassName}>
                    <Viewport rect={{ left: 0, top: 0, width: 0.5, height: 1 }} />
                    <Viewport rect={{ left: 0.5, top: 0, width: 0.5, height: 1 }} />
                </Canvas>
            </div>
        </Livelink>
    ),
};

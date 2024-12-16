//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    LoadingSpinner,
    sampleCanvasClassName,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const title = "Double Canvas";
const summary = "Two canvases, each with their own viewport.";
const description = "";
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: "double-canvas-single-viewport",
    title,
    summary,
    description,
    element: (
        <SamplePlayer title={title} summary={summary} description={description}>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <div className="flex basis-full">
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport />
                    </Canvas>
                </div>
                <div className="flex basis-full">
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport />
                    </Canvas>
                </div>
            </Livelink>
        </SamplePlayer>
    ),
};

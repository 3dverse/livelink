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
import description from "./1-single-canvas-single-viewport.md";

//------------------------------------------------------------------------------
const title = "Single Viewport";
const summary = "A single viewport inside a single canvas.";
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const path = import.meta.url;
console.log(path);

//------------------------------------------------------------------------------
export default {
    path: "single-canvas-single-viewport",
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
                <Canvas className={sampleCanvasClassName}>
                    <Viewport />
                </Canvas>
            </Livelink>
        </SamplePlayer>
    ),
};

//------------------------------------------------------------------------------
import { RelativeRect } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    LoadingSpinner,
    sampleCanvasClassName,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const title = "Viewport in Viewport";
const summary = "A viewport inside a viewport.";
const description = "";
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: "viewport-in-viewport",
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
                    <Viewport>
                        <Viewport rect={new RelativeRect({ left: 0.7, top: 0.05, width: 0.25, height: 0.2 })} />
                    </Viewport>
                </Canvas>
            </Livelink>
        </SamplePlayer>
    ),
};

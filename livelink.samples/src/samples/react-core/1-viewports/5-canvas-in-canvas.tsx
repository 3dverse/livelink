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
    title: "Canvas in Canvas",
    summary: "A canvas inside a canvas.",
    element: (
        <Livelink
            scene_id={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            disconnectedModal={<DisconnectedModal />}
        >
            <div className="relative flex basis-full">
                <Canvas className={sampleCanvasClassName}>
                    <Viewport>
                        <div className="absolute top-3/4 left-8 bottom-8 right-8 border border-tertiary rounded-lg shadow-2xl">
                            <Canvas className={sampleCanvasClassName}>
                                <Viewport />
                            </Canvas>
                        </div>
                    </Viewport>
                </Canvas>
            </div>
        </Livelink>
    ),
};

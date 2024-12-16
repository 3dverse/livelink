//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, DefaultCamera, Camera } from "@3dverse/livelink-react";

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
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="relative w-full h-full">
                    <Camera class={DefaultCamera} name={"MyCamera1"} />
                    <Canvas className="top-20 right-4 w-1/4 aspect-video border border-tertiary rounded-xl shadow-2xl">
                        <Viewport className="w-full h-full">
                            <Camera class={DefaultCamera} name={"MyCamera2"} />
                        </Viewport>
                    </Canvas>
                </Viewport>
            </Canvas>
        </Livelink>
    ),
};

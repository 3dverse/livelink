//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Double Canvas",
    summary: "Two canvases, each with their own viewport.",
    element: (
        <Livelink
            scene_id={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            disconnectedModal={<DisconnectedModal />}
        >
            <div className="flex basis-full gap-2">
                <Canvas className={sampleCanvasClassName}>
                    <Viewport className="w-full h-full">
                        <Camera class={DefaultCamera} name={"MyCamera1"} />
                    </Viewport>
                </Canvas>
                <Canvas className={sampleCanvasClassName}>
                    <Viewport className="w-full h-full">
                        <Camera class={DefaultCamera} name={"MyCamera2"} />
                    </Viewport>
                </Canvas>
            </div>
        </Livelink>
    ),
};

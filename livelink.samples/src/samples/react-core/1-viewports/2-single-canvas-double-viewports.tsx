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
    title: "Double Viewport",
    summary: "Two viewports sharing the same canvas.",
    element: (
        <Livelink
            scene_id={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            disconnectedModal={<DisconnectedModal />}
        >
            <Canvas className={`${sampleCanvasClassName} flex`}>
                <Viewport className="basis-[60%]">
                    <Camera class={DefaultCamera} name={"MyCamera1"} />
                </Viewport>
                <Viewport className="grow">
                    <Camera class={DefaultCamera} name={"MyCamera2"} />
                </Viewport>
            </Canvas>
        </Livelink>
    ),
};

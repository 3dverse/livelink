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
    title: "Multi-Viewports Double Canvas",
    summary: "Two canvases having two viewports each.",
    element: (
        <Livelink
            sceneId={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            connectionLostPanel={<DisconnectedModal />}
        >
            <div className="flex basis-full gap-2">
                <Canvas className={`${sampleCanvasClassName} flex flex-col`}>
                    <Viewport className="basis-1/2">
                        <Camera class={DefaultCamera} name={"MyCamera1"} />
                    </Viewport>
                    <Viewport className="basis-1/2">
                        <Camera class={DefaultCamera} name={"MyCamera2"} />
                    </Viewport>
                </Canvas>
                <Canvas className={`${sampleCanvasClassName} flex flex-row`}>
                    <Viewport className="basis-1/2">
                        <Camera class={DefaultCamera} name={"MyCamera3"} />
                    </Viewport>
                    <Viewport className="basis-1/2">
                        <Camera class={DefaultCamera} name={"MyCamera4"} />
                    </Viewport>
                </Canvas>
            </div>
        </Livelink>
    ),
};

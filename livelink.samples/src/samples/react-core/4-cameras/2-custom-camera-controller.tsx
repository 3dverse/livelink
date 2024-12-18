//------------------------------------------------------------------------------
import { Camera as LivelinkCamera } from "@3dverse/livelink";
import { Livelink, Canvas, Viewport, Camera } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
class CustomCamera extends LivelinkCamera {
    private _speed = 1;
    onCreate() {
        const DEFAULT_RENDER_GRAPH_REF = "398ee642-030a-45e7-95df-7147f6c43392" as const;

        this.local_transform = { position: [0, 2, 5] };
        this.camera = {
            renderGraphRef: DEFAULT_RENDER_GRAPH_REF,
            dataJSON: { grid: true, skybox: false, gradient: true },
        };
        this.perspective_lens = {
            aspectRatio: 1,
            fovy: 60,
            nearPlane: 0.1,
            farPlane: 10000,
        };
    }

    onUpdate({ elapsed_time }: { elapsed_time: number }): void {
        this.local_transform!.position![1] = 1 + Math.sin(elapsed_time * this._speed);
    }
}

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Custom Controller",
    summary: "Shows how to create a custom camera controller.",
    element: (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Camera class={CustomCamera} name={"MyCustomCamera"} />
                </Viewport>
            </Canvas>
        </Livelink>
    ),
};

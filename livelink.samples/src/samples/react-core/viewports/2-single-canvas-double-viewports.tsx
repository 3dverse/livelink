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
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function SingleCanvasDoubleViewports() {
    return (
        <SamplePlayer>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <Canvas className={sampleCanvasClassName}>
                    <Viewport rect={new RelativeRect({ left: 0, width: 0.5, height: 1 })} />
                    <Viewport rect={new RelativeRect({ left: 0.5, width: 0.5, height: 1 })} />
                </Canvas>
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, DOM3DOverlay, DOM3DElement } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    LoadingSpinner,
    sampleCanvasClassName,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default function DOM3DOverlayViewport() {
    return (
        <SamplePlayer>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <Canvas className={sampleCanvasClassName}>
                    <Viewport>
                        <DOM3DOverlay>
                            <DOM3DElement world_position={[2, 0, 0]} pixel_dimensions={[1, 1]}>
                                <p className="bg-ground p-4 rounded-lg">
                                    I'm a DOM 3D Element. <br />
                                    I'm positionned in the 3d world at [2,0,0].
                                    <br />
                                    My size stays constant regardless of camera position.
                                </p>
                            </DOM3DElement>
                            <DOM3DElement world_position={[-2, 1, 0]} pixel_dimensions={[1, 1]} scale_factor={0.0025}>
                                <p className="bg-underground p-4 rounded-lg">
                                    I'm also a DOM 3D Element. <br />
                                    I'm positionned in the 3d world at [-2,1,0].
                                    <br />
                                    My size varies depending on the camera position.
                                </p>
                            </DOM3DElement>
                            <DOM3DElement world_position={[0, 0, -5]} pixel_dimensions={[1, 1]} scale_factor={0.0025}>
                                <>
                                    <img
                                        src="https://console.3dverse.com/static/logo/3dverse-wordmark.svg"
                                        className="h-60"
                                    />
                                    <p className="bg-underground p-4 rounded-lg">Any DOM element can be used.</p>
                                </>
                            </DOM3DElement>

                            <DOM3DElement world_position={[-3, 2, -1]} pixel_dimensions={[1, 1]} scale_factor={0.0025}>
                                <p className="bg-informative-800 opacity-80 p-4 rounded-lg select-none pointer-events-none">
                                    Note that DOM 3D elements will always appear on top of the 3dverse scene.
                                </p>
                            </DOM3DElement>
                        </DOM3DOverlay>
                    </Viewport>
                </Canvas>
            </Livelink>
        </SamplePlayer>
    );
}

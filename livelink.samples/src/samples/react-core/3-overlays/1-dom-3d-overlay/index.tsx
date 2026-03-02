//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DAnchor,
    CameraController,
    useCameraEntity,
    DOM3DDiv,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import type { Vec3 } from "@3dverse/livelink";
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    const [dynamicPosition, setDynamicPosition] = useState<Vec3>([2, 0, 0]);
    const [dynamicScaleFactor, setDynamicScaleFactor] = useState(0.005);

    useEffect(() => {
        const interval = setInterval(() => {
            const time = Date.now() / 1000;
            const sin = Math.sin(time);
            setDynamicPosition(prev => [prev[0], prev[1], sin * 2]);
            setDynamicScaleFactor(((sin + 1) / 2) * 0.005 + 0.005);
        }, 1000 / 60);

        return () => clearInterval(interval);
    }, []);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    <DOM3DDiv
                        worldQuad={{
                            tl: [-1, 2, -5],
                            tr: [1, 2, -5],
                            br: [1, 0, -5],
                            bl: [-1, 0, -5],
                        }}
                        className="bg-blue-500/20 text-black border-dashed border-2 border-blue-700/80 p-1 text-md"
                    >
                        I am a DOM 3D &lt;div&gt;
                    </DOM3DDiv>
                    <DOM3DDiv
                        worldQuad={{
                            tl: [-dynamicPosition[2], 2, 5],
                            tr: [1, 2, 5],
                            br: [1, 0, 5],
                            bl: [-dynamicPosition[2], 0, 5],
                        }}
                        className="bg-red-500/20 text-black border-dashed border-2 border-red-700/80 p-1 text-md"
                    >
                        I am a dynamically resized DOM 3D &lt;div&gt;
                    </DOM3DDiv>
                    <DOM3DAnchor worldPosition={[2, 0, 0]}>
                        <p className="bg-ground/80 p-4 rounded-lg">
                            I'm a DOM 3D Anchor. <br />
                            I'm positionned in the 3d world at [2,0,0].
                            <br />
                            My size stays constant regardless of camera
                            position.
                        </p>
                    </DOM3DAnchor>
                    <DOM3DAnchor worldPosition={[-2, 1, 0]} scaleFactor={0.005}>
                        <p className="bg-underground p-4 rounded-lg">
                            I'm also a DOM 3D Anchor. <br />
                            I'm positionned in the 3d world at [-2,1,0].
                            <br />
                            My size varies depending on the camera position.
                        </p>
                    </DOM3DAnchor>
                    <DOM3DAnchor worldPosition={[0, 0, -5]} scaleFactor={0.005}>
                        <>
                            <img
                                src="https://cdn.3dverse.com/assets/3dverse-wordmark.svg"
                                className="h-60"
                            />
                            <p className="bg-underground p-4 rounded-lg">
                                DOM Element intersect each other
                            </p>
                        </>
                    </DOM3DAnchor>

                    <DOM3DAnchor
                        worldPosition={[-3, 2, -1]}
                        scaleFactor={0.005}
                    >
                        <p className="bg-informative/80 p-4 rounded-lg select-none pointer-events-none">
                            Note that DOM 3D elements will always appear on top
                            of the 3dverse scene.
                        </p>
                    </DOM3DAnchor>

                    <DOM3DAnchor
                        worldPosition={dynamicPosition}
                        scaleFactor={0.005}
                    >
                        <p className="bg-underground p-4 rounded-lg">
                            I'm moving DOM 3D Anchor. <br />
                            My position is updated every frame.
                            <br />
                            I'm positionned in the 3d world at [
                            {dynamicPosition[0].toFixed(2)},
                            {dynamicPosition[1].toFixed(2)},
                            {dynamicPosition[2].toFixed(2)}].
                            <br />
                            Even when no frame is received from the server, I'm
                            still moving.
                        </p>
                    </DOM3DAnchor>

                    <DOM3DAnchor
                        worldPosition={[-3, 0, 2]}
                        scaleFactor={dynamicScaleFactor}
                    >
                        <p className="bg-underground p-4 rounded-lg">
                            I'm scaling DOM 3D Anchor. <br />
                            My scale is updated every frame.
                            <br />
                            Scale Factor: {dynamicScaleFactor.toFixed(4)}
                        </p>
                    </DOM3DAnchor>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

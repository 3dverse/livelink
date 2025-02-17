//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DElement,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "DOM 3D Overlay",
    summary:
        "A viewport with a DOM 3D overlay to display DOM elements located in the 3D world.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
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

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    <DOM3DElement worldPosition={[2, 0, 0]}>
                        <p className="bg-ground p-4 rounded-lg">
                            I'm a DOM 3D Element. <br />
                            I'm positionned in the 3d world at [2,0,0].
                            <br />
                            My size stays constant regardless of camera
                            position.
                        </p>
                    </DOM3DElement>
                    <DOM3DElement
                        worldPosition={[-2, 1, 0]}
                        scaleFactor={0.0025}
                    >
                        <p className="bg-underground p-4 rounded-lg">
                            I'm also a DOM 3D Element. <br />
                            I'm positionned in the 3d world at [-2,1,0].
                            <br />
                            My size varies depending on the camera position.
                        </p>
                    </DOM3DElement>
                    <DOM3DElement
                        worldPosition={[0, 0, -5]}
                        scaleFactor={0.0025}
                    >
                        <>
                            <img
                                src="https://cdn.3dverse.com/assets/3dverse-wordmark.svg"
                                className="h-60"
                            />
                            <p className="bg-underground p-4 rounded-lg">
                                Any DOM element can be used.
                            </p>
                        </>
                    </DOM3DElement>

                    <DOM3DElement
                        worldPosition={[-3, 2, -1]}
                        scaleFactor={0.0025}
                    >
                        <p className="bg-informative-800 opacity-80 p-4 rounded-lg select-none pointer-events-none">
                            Note that DOM 3D elements will always appear on top
                            of the 3dverse scene.
                        </p>
                    </DOM3DElement>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

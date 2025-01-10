//------------------------------------------------------------------------------
import { useMemo } from "react";
import * as THREE from "three";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DElement,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import { ThreeOverlay } from "@3dverse/livelink-three/react";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Multi Overlay",
    summary:
        "A viewport with a DOM overlay and a Three.js overlay that displays DOM elements on top of a Three.js scene rendered on top of the 3dverse scene.",
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

    const scene = useMemo(() => {
        const scene = new THREE.Scene();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 2.5, 0);
        scene.add(cube);
        return scene;
    }, []);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <ThreeOverlay scene={scene} />

                <DOM3DOverlay>
                    <DOM3DElement
                        worldPosition={[0, 1.5, 0]}
                        scaleFactor={0.0025}
                    >
                        <p className="bg-ground p-4 rounded-lg select-none pointer-events-none">
                            ↑ Over me is a Three.js rendered cube ↑
                            <br />↓ Beneath me is a 3dverse rendered cube ↓
                        </p>
                    </DOM3DElement>

                    <DOM3DElement
                        worldPosition={[-3, 1.5, -1]}
                        scaleFactor={0.0025}
                    >
                        <p className="bg-informative-800 opacity-80 p-4 rounded-lg select-none pointer-events-none">
                            Note that there's no depth composition between
                            layers.
                            <br />
                            DOM 3D elements will always appear on top.
                            <br />
                            Then WebGL rendered elements.
                            <br />
                            And finally the 3dverse scene.
                        </p>
                    </DOM3DElement>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

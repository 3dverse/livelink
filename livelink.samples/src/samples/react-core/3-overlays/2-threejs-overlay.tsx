//------------------------------------------------------------------------------
import { useMemo } from "react";
import * as THREE from "three";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
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
    title: "Three.js Overlay",
    summary:
        "A viewport with a Three.js overlay that displays a Three.js scene rendered on top of the 3dverse scene.",
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
        cube.position.set(0, 0.5, 0);
        scene.add(cube);
        return scene;
    }, []);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <ThreeOverlay scene={scene} />
            </Viewport>
        </Canvas>
    );
}

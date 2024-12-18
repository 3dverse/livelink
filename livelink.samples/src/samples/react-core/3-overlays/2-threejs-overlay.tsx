//------------------------------------------------------------------------------
import { useMemo } from "react";

//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera } from "@3dverse/livelink-react";
import { ThreeOverlay } from "@3dverse/livelink-three/react";

//------------------------------------------------------------------------------
import * as THREE from "three";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Three.js Overlay",
    summary: "A viewport with a Three.js overlay that displays a Three.js scene rendered on top of the 3dverse scene.",
    element: (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Camera class={DefaultCamera} name={"MyCamera"} />
                    <ThreeOverlayScene />
                </Viewport>
            </Canvas>
        </Livelink>
    ),
};

//------------------------------------------------------------------------------
function ThreeOverlayScene() {
    const scene = useMemo(() => {
        const scene = new THREE.Scene();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0.5, 0);
        scene.add(cube);
        return scene;
    }, []);

    return <ThreeOverlay scene={scene} />;
}

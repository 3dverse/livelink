//------------------------------------------------------------------------------
import { useMemo } from "react";

//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, DOM3DOverlay, DOM3DElement } from "@3dverse/livelink-react";
import { ThreeOverlay } from "@3dverse/livelink-three/react";

//------------------------------------------------------------------------------
import * as THREE from "three";

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
export default function MultiOverlayViewport() {
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
        <SamplePlayer>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <Canvas className={sampleCanvasClassName}>
                    <Viewport>
                        <ThreeOverlay scene={scene} />

                        <DOM3DOverlay>
                            <DOM3DElement world_position={[0, 1.5, 0]} pixel_dimensions={[1, 1]} scale_factor={0.0025}>
                                <p className="bg-ground p-4 rounded-lg select-none pointer-events-none">
                                    ↑ Over me is a Three.js rendered cube ↑
                                    <br />↓ Beneath me is a 3dverse rendered cube ↓
                                </p>
                            </DOM3DElement>

                            <DOM3DElement
                                world_position={[-3, 1.5, -1]}
                                pixel_dimensions={[1, 1]}
                                scale_factor={0.0025}
                            >
                                <p className="bg-informative-800 opacity-80 p-4 rounded-lg select-none pointer-events-none">
                                    Note that there's no depth composition between layers.
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
            </Livelink>
        </SamplePlayer>
    );
}

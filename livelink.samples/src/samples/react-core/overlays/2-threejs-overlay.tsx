//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport } from "@3dverse/livelink-react";
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
export default function ThreeOverlayViewport() {
    const [scene] = useState(new THREE.Scene());

    useEffect(() => {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0.5, 0);
        scene.add(cube);
    }, [scene]);

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
                        <ThreeOverlay scene={scene}></ThreeOverlay>
                    </Viewport>
                </Canvas>
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { DOM3DElement, DOM3DOverlay, Livelink, Viewport } from "@3dverse/livelink-react";
import { ThreeOverlay } from "@3dverse/livelink-three/react";
import * as THREE from "three";
import BoringAvatar from "boring-avatars";
import StyledCanvas from "../../components/Canvas";

//------------------------------------------------------------------------------
export default function DoubleCanvas() {
    const [scene, setScene] = useState<THREE.Scene | null>(null);

    useEffect(() => {
        const scene = new THREE.Scene();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        setScene(scene);
    }, []);

    return (
        <Livelink scene_id="e7d69f14-d18e-446b-8df3-cbd24e10fa92" token="public_p54ra95AMAnZdTel">
            <div className="w-full h-full flex gap-3 p-3 lg:pl-0">
                <div className="flex basis-full relative">
                    <StyledCanvas>
                        <Viewport>
                            <DOM3DOverlay>
                                <DOM3DElement world_position={[0, 0, 0]} pixel_dimensions={[40, 40]}>
                                    <BoringAvatar size={40} variant="beam" />
                                </DOM3DElement>
                            </DOM3DOverlay>
                            {scene && <ThreeOverlay scene={scene} />}
                        </Viewport>
                    </StyledCanvas>
                </div>
                <div className="flex basis-full relative">
                    <StyledCanvas>
                        <Viewport>{scene && <ThreeOverlay scene={scene} />}</Viewport>
                    </StyledCanvas>
                </div>
            </div>
        </Livelink>
    );
}

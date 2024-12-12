//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import * as THREE from "three";

//------------------------------------------------------------------------------
import { RelativeRect } from "@3dverse/livelink";
import { useLivelinkInstance } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import Canvas from "../../components/Canvas";

//------------------------------------------------------------------------------
export default function ThreeJS() {
    return null;
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const views = [
        {
            canvas_ref: canvasRef1,
            rect: new RelativeRect({ top: 0.0, height: 0.5 }),
            enable_threejs: true,
        },
        {
            canvas_ref: canvasRef1,
            rect: new RelativeRect({ top: 0.5, height: 0.5 }),
            enable_threejs: true,
        },
        {
            canvas_ref: canvasRef2,
            rect: new RelativeRect({ top: 0, height: 0.5 }),
            enable_threejs: false,
        },
        {
            canvas_ref: canvasRef2,
            rect: new RelativeRect({ top: 0.5, height: 0.5 }),
            enable_threejs: true,
        },
    ];

    const { instance, connect } = useLivelinkInstance({ views });
    const { scene } = useThreeJsOverlay({ instance, views });

    useEffect(() => {
        connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
    }, []);

    useEffect(() => {
        if (!scene) {
            return;
        }
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
    }, [scene]);

    return (
        <div className="w-full h-full flex gap-3 p-3 lg:pl-0">
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef1} />
            </div>
            <div className="flex basis-full">
                <Canvas canvasRef={canvasRef2} />
            </div>
        </div>
    );
}

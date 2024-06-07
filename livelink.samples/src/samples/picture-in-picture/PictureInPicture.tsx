//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { AnimationSequence, Camera, Livelink } from "livelink.js";
import { Manifest } from "../../hooks/useSmartObject";
import { DefaultCamera } from "../../components/DefaultCamera";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    MyAnimSeq: "cb52924a-b2d5-47b2-b6c7-17d50a9a3209",
};

//------------------------------------------------------------------------------
export default function PictureInPicture() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);
    const [animationSeq, setAnimationSeq] = useState<AnimationSequence | null>(null);

    const { instance, connect } = useLivelinkInstance({
        views: [
            { canvas_ref: canvasRef1, camera: DefaultCamera },
            { canvas_ref: canvasRef2, camera: "b6f3ddc0-cd50-4ab1-be71-4c28772dc540" },
        ],
    });

    useEffect(() => {
        connect({ scene_id: "7e408a29-6982-4e2b-a93c-fb3872075033", token: "public_p54ra95AMAnZdTel" }).then(
            (v: { instance: Livelink; cameras: Array<Camera | null> } | null) => {
                if (v && v.cameras[0] !== null) {
                    const d = v.cameras[0].camera?.dataJSON as {
                        grid: boolean;
                        volumetricLighting: boolean;
                        bloom: boolean;
                        filterSpecular: boolean;
                    };
                    d.grid = false;
                    d.volumetricLighting = true;
                    d.bloom = true;
                    d.filterSpecular = true;
                }
            },
        );
    }, []);

    useEffect(() => {
        if (instance) {
            setAnimationSeq(
                instance.scene.getAnimationSequence({ animation_sequence_id: SmartObjectManifest.MyAnimSeq }),
            );
        }
    }, [instance]);

    useEffect(() => {
        if (animationSeq) {
            animationSeq.play({ playback_speed: 0.1 });
        }
    }, [animationSeq]);

    return (
        <div className="w-full h-full flex basis-full flex-row grow gap-4 p-4">
            <div className="relative flex basis-full">
                <Canvas canvasRef={canvasRef1} />
                <div className="absolute top-3/4 left-8 bottom-8 right-8 border border-color-tertiary rounded-lg shadow-2xl">
                    <Canvas canvasRef={canvasRef2} />
                </div>
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, DefaultCamera } from "@3dverse/livelink-react";
import { AnimationSequence, Camera, Livelink, RenderingSurface, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const SmartObjectManifest = {
    MyAnimSeq: "cb52924a-b2d5-47b2-b6c7-17d50a9a3209",
} as const;

//------------------------------------------------------------------------------
export default function RenderTargetDebug() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);
    const canvasRef3 = useRef<HTMLCanvasElement>(null);
    const canvasRef4 = useRef<HTMLCanvasElement>(null);
    const [animationSeq, setAnimationSeq] = useState<AnimationSequence | null>(null);

    const { instance, connect } = useLivelinkInstance({
        views: [{ canvas_ref: canvasRef1, camera: DefaultCamera }],
    });

    useEffect(() => {
        connect({ scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d", token: "public_p54ra95AMAnZdTel" }).then(
            (v: { instance: Livelink; cameras: Array<Camera | null> } | null) => {
                if (!v || !v.instance || v.cameras[0] === null) {
                    return;
                }

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

                if (!canvasRef2.current || !canvasRef3.current || !canvasRef4.current) {
                    return;
                }

                const viewports = [
                    new Viewport(
                        v.instance,
                        new RenderingSurface({ canvas_element: canvasRef2.current, context_type: "2d" }),
                        { render_target_index: 14 },
                    ),
                    new Viewport(
                        v.instance,
                        new RenderingSurface({ canvas_element: canvasRef3.current, context_type: "2d" }),
                        { render_target_index: 15 },
                    ),
                    new Viewport(
                        v.instance,
                        new RenderingSurface({ canvas_element: canvasRef4.current, context_type: "2d" }),
                        { render_target_index: 17 },
                    ),
                ];

                for (const viewport of viewports) {
                    viewport.camera = v.cameras[0];
                }
                v.instance.addViewports({ viewports });
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
        <div className="w-full h-full flex gap-3 p-3 pl-0">
            <div className="relative flex basis-full">
                <Canvas canvasRef={canvasRef1} />
                <div className="absolute h-full left-2 top-2 w-3/12 flex flex-col gap-2">
                    <div className="h-1/6 border border-tertiary rounded-lg shadow-2xl">
                        <Canvas canvasRef={canvasRef2} />
                    </div>
                    <div className="h-1/6 border border-tertiary rounded-lg shadow-2xl">
                        <Canvas canvasRef={canvasRef3} />
                    </div>
                    <div className="h-1/6 border border-tertiary rounded-lg shadow-2xl">
                        <Canvas canvasRef={canvasRef4} />
                    </div>
                </div>
            </div>
        </div>
    );
}

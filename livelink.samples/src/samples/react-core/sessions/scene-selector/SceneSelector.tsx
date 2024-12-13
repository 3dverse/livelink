//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import Canvas from "../../../../components/Canvas";
import { useLivelinkInstance } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
const scenes = [
    { name: "Droid", scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7" },
    { name: "Sponza", scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d" },
];

//------------------------------------------------------------------------------
export default function SceneSelector() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scene_id, setSceneId] = useState("default");

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    useEffect(() => {
        if (instance) {
            disconnect();
        }
        if (scene_id !== "default") {
            connect({ scene_id, token: "public_p54ra95AMAnZdTel" });
        }
    }, [scene_id]);

    return (
        <>
            <div className="w-full h-full relative">
                <div className="w-full h-full p-3 lg:pl-0">
                    <Canvas canvasRef={canvasRef} />
                </div>
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
                    <select
                        className="select select-primary w-full min-w-[20rem]"
                        value={scene_id}
                        onChange={event => {
                            setSceneId(event.target.value);
                        }}
                    >
                        <option value={"default"} disabled>
                            Pick a scene
                        </option>
                        {scenes.map((item, i) => (
                            <option key={i} value={item.scene_id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </>
    );
}

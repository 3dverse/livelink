//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { Select } from "react-daisyui";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";

//------------------------------------------------------------------------------
const scenes = [
    { name: "Droid", scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7" },
    { name: "Sponza", scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d" },
];
//------------------------------------------------------------------------------
export default function SceneSelector() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scene_id, setSceneId] = useState("default");

    const { instance, connect, disconnect } = useLivelinkInstance({
        canvas_refs: [canvasRef],
        token: "public_p54ra95AMAnZdTel",
    });

    useEffect(() => {
        if (instance) {
            disconnect();
        }
        if (scene_id !== "default") {
            connect({ scene_id });
        }
    }, [scene_id]);

    return (
        <>
            <div className="w-full h-full relative">
                <div className="w-full h-full p-4">
                    <Canvas canvasRef={canvasRef} />
                </div>
                <div className="absolute bottom-4 left-0 flex w-full component-preview p-4 items-center justify-center gap-2 font-sans">
                    <Select
                        className="w-full max-w-xs"
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
                    </Select>
                </div>
            </div>
        </>
    );
}

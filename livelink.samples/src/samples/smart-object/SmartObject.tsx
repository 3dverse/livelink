import { useRef } from "react";
import { Input, Range } from "react-daisyui";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, Manifest, useSmartObject } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest: Manifest = {
    MyLight: "c03314f2-c943-41be-ae17-f0d655cf1d11",
};

function rgbToHex(c: Array<number>) {
    function componentToHex(c: number) {
        const hex = (c * 255).toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    return "#" + componentToHex(c[0]) + componentToHex(c[1]) + componentToHex(c[2]);
}

function hexToRgb(h: string): [number, number, number] {
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

//------------------------------------------------------------------------------
export default function SmartObject() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const light = useSmartObject({ instance, manifest: SmartObjectManifest, smart_object: "MyLight" });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else {
            await connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
        }
    };

    return (
        <>
            <div className="w-full h-full relative">
                <div className="w-full h-full p-4">
                    <Canvas canvasRef={canvasRef} />
                </div>

                {light && (
                    <div className="fixed top-6 right-6">
                        <Input
                            type="color"
                            className="p-1 h-10 w-14 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"
                            id="hs-color-input"
                            defaultValue={rgbToHex(light.point_light!.color!)}
                            title="Choose your color"
                            onChange={e => (light.point_light!.color = hexToRgb(e.target.value.substring(1)))}
                        />
                        <Range
                            min={0}
                            max={10}
                            defaultValue={light.point_light!.intensity!}
                            onChange={e => (light.point_light!.intensity = Number(e.target.value))}
                        />
                    </div>
                )}
                <CanvasActionBar isCentered={!instance}>
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                </CanvasActionBar>
            </div>
        </>
    );
}

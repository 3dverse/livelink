import { useRef } from "react";
import * as Livelink from "@3dverse/livelink";
import { Input, Range } from "react-daisyui";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance, useEntity } from "@3dverse/livelink-react";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const SmartObjectManifest = {
    MyLight: "c03314f2-c943-41be-ae17-f0d655cf1d11",
} as const;

//------------------------------------------------------------------------------
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
export default function SmartObjectSync() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const {
        instance: instance1,
        connect: connect1,
        disconnect: disconnect1,
    } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef1 }] });

    const {
        instance: instance2,
        connect: connect2,
        disconnect: disconnect2,
    } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef2 }] });

    const light1 = useEntity({ instance: instance1, entity_uuid: SmartObjectManifest.MyLight });
    const light2 = useEntity({ instance: instance2, entity_uuid: SmartObjectManifest.MyLight });

    const toggleConnection = async () => {
        for (const { instance, connect, disconnect } of [
            { instance: instance1, connect: connect1, disconnect: disconnect1 },
            { instance: instance2, connect: connect2, disconnect: disconnect2 },
        ]) {
            if (instance) {
                disconnect();
            } else {
                await connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
            }
        }
    };

    return (
        <div className="relative h-full">
            <div className="h-full flex gap-3 p-3 lg:pl-0">
                <CanvasWithControl canvasRef={canvasRef1} light={light1} />
                <CanvasWithControl canvasRef={canvasRef2} light={light2} />
            </div>
            <CanvasActionBar isCentered={!instance1}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance1 ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </div>
    );
}

//------------------------------------------------------------------------------
function CanvasWithControl({
    canvasRef,
    light,
}: {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    light: Livelink.Entity | null;
}) {
    return (
        <div className="relative w-full h-full flex grow">
            <Canvas canvasRef={canvasRef} />

            {light && (
                <div className="absolute top-6 right-6">
                    <Input
                        type="color"
                        className="p-1 h-10 w-14 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"
                        id="hs-color-input"
                        value={rgbToHex(light.point_light!.color!)}
                        title="Choose your color"
                        onChange={e => (light!.point_light!.color = hexToRgb(e.target.value.substring(1)))}
                    />
                    <Range
                        min={0}
                        max={10}
                        value={light.point_light!.intensity!}
                        onChange={e => (light.point_light!.intensity! = Number(e.target.value))}
                    />
                    <button
                        className="button button-primary"
                        onClick={() => {
                            delete light.point_light!.color;
                            delete light.point_light!.intensity;
                        }}
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    );
}

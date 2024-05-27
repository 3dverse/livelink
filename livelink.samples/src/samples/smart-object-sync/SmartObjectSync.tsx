import { useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import * as LiveLink from "livelink.js";
import { Button, Input, Range } from "react-daisyui";
import { useLiveLinkInstance } from "../../hooks/useLiveLinkInstance";

//------------------------------------------------------------------------------
const SmartObjectManifest: Record<string, string> = {
    MyLight: "c03314f2-c943-41be-ae17-f0d655cf1d11",
};

//------------------------------------------------------------------------------
async function findSmartObject(instance: LiveLink.LiveLink, objectName: string) {
    if (!(objectName in SmartObjectManifest)) {
        throw new Error(`Unknown SmartObject ${objectName}`);
    }

    if (!instance) {
        return { isLoading: true, entity: null };
    }

    const entity = await instance.findEntity(LiveLink.Entity, {
        entity_uuid: SmartObjectManifest[objectName],
    });

    return { isLoading: false, entity };
}

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
    const [entity1, setEntity1] = useState<LiveLink.Entity | null>(null);
    const [entity2, setEntity2] = useState<LiveLink.Entity | null>(null);

    const {
        instance: instance1,
        connect: connect1,
        disconnect: disconnect1,
    } = useLiveLinkInstance({
        canvas_refs: [canvasRef1],
        token: "public_p54ra95AMAnZdTel",
    });

    const {
        instance: instance2,
        connect: connect2,
        disconnect: disconnect2,
    } = useLiveLinkInstance({
        canvas_refs: [canvasRef2],
        token: "public_p54ra95AMAnZdTel",
    });

    const toggleConnection1 = async () => {
        if (instance1) {
            setEntity1(null);
            disconnect1();
        } else if (canvasRef1.current) {
            const inst = await connect1({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
            });
            if (!inst) {
                return;
            }
            const { entity: soLight } = await findSmartObject(inst, "MyLight");

            if (soLight) {
                soLight.__self.addEventListener("entity-updated", () => {
                    setEntity1(null);
                    setTimeout(() => setEntity1(soLight), 0);
                });
            }

            setEntity1(soLight);
        }
    };

    const toggleConnection2 = async () => {
        if (instance2) {
            setEntity2(null);
            disconnect2();
        } else if (canvasRef2.current) {
            const inst = await connect2({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
            });
            if (!inst) {
                return;
            }
            const { entity: soLight } = await findSmartObject(inst, "MyLight");

            if (soLight) {
                soLight.__self.addEventListener("entity-updated", () => {
                    setEntity2(null);
                    setTimeout(() => setEntity2(soLight), 0);
                });
            }

            setEntity2(soLight);
        }
    };

    const toggleConnection = async () => {
        toggleConnection1();
        toggleConnection2();
    };

    return (
        <div className="w-full h-full flex flex-col items-center">
            <div className="flex flex-row flex-grow items-center">
                <CanvasWithControl canvasRef={canvasRef1} light={entity1} />
                <CanvasWithControl canvasRef={canvasRef2} light={entity2} />
            </div>
            <div className="flex items-center gap-2 pb-4">
                <Button shape="circle" variant="outline" onClick={toggleConnection}>
                    {instance1 ? "Disconnect" : "Connect"}
                </Button>
            </div>
        </div>
    );
}

function CanvasWithControl({
    canvasRef,
    light,
}: {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    light: LiveLink.Entity | null;
}) {
    return (
        <>
            <div className="relative w-full h-full flex basis-full grow p-4">
                <Canvas canvasRef={canvasRef} />

                {light && (
                    <div className="absolute top-6 right-6">
                        <Input
                            type="color"
                            className="p-1 h-10 w-14 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"
                            id="hs-color-input"
                            defaultValue={rgbToHex(light.point_light.color)}
                            title="Choose your color"
                            onChange={e => (light.point_light.color = hexToRgb(e.target.value.substring(1)))}
                        />
                        <Range
                            min={0}
                            max={10}
                            defaultValue={light.point_light.intensity}
                            onChange={e => (light.point_light.intensity = Number(e.target.value))}
                        />
                    </div>
                )}
            </div>
        </>
    );
}

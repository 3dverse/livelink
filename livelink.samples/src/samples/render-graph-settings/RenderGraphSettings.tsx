import { useEffect, useRef, useState } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import { RenderGraphSettings } from "@3dverse/livelink-react-ui";
import { Camera } from "@3dverse/livelink";

import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import Canvas from "../../components/Canvas";
import { defaultCameraSettings } from "./defaultCameraSettings";

//------------------------------------------------------------------------------
export default function RenderGraphSettingsSample() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const [cameraEntity, setCameraEntity] = useState<Camera>();

    useEffect(() => {
        if (!instance) return;

        const cameraEntity = instance.viewports[0].camera;
        if (!cameraEntity) return;

        setCameraEntity(cameraEntity);
    }, [instance]);

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else {
            await connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
                token: "public_p54ra95AMAnZdTel",
                is_transient: true,
            });
        }
    };

    return (
        <>
            <div className="w-full h-full relative">
                <div className="w-full h-full p-3 lg:pl-0">
                    <Canvas canvasRef={canvasRef} />
                </div>

                {cameraEntity && (
                    <aside className="absolute top-5 right-8">
                        <p className="text-xs my-2">Render graph settings</p>
                        <RenderGraphSettings
                            cameraEntity={cameraEntity}
                            defaultCameraSettings={defaultCameraSettings}
                        />
                    </aside>
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

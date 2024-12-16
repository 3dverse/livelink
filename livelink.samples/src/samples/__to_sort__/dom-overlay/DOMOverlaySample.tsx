//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";

//------------------------------------------------------------------------------
import { useLivelinkInstance } from "@3dverse/livelink-react";
import { RelativeRect, type RenderingSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import LegacyCanvas from "../../../components/LegacyCanvas";
import { DOMOverlay } from "./overlay/DOMOverlay";

//------------------------------------------------------------------------------
export default function DOMOverlaySample() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const views = [
        {
            canvas_ref: canvasRef,
            rect: new RelativeRect({ top: 0.0, height: 0.5 }),
        },
        {
            canvas_ref: canvasRef,
            rect: new RelativeRect({ top: 0.5, height: 0.5 }),
        },
    ];

    const { instance, connect } = useLivelinkInstance({ views });

    useEffect(() => {
        connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
    }, []);

    useEffect(() => {
        if (!instance || !canvasRef.current || !containerRef.current) {
            return;
        }

        const overlay = new DOMOverlay({ canvas: canvasRef.current, container: containerRef.current });

        const renderingSurface = instance.viewports[0].rendering_surface as RenderingSurface;
        renderingSurface.addOverlay({ overlay });

        for (const viewport of instance.viewports) {
            overlay.addViewport({ viewport });
        }

        const element = document.createElement("img");
        element.src = "https://console.3dverse.com/static/logo/3dverse-wordmark.svg";
        element.style.height = "110px";

        const domElement = overlay.addElement({ element, pixel_dimensions: [50, 100] });
        domElement.world_position.fill(0);

        return () => {
            renderingSurface.removeOverlay({ overlay });
        };
    }, [instance, canvasRef, containerRef]);

    return (
        <div className="w-full h-full flex gap-3 p-3 lg:pl-0">
            <div className="relative flex basis-full">
                <div className="absolute basis-full z-10 pointer-events-none" ref={containerRef} />
                <LegacyCanvas canvasRef={canvasRef} />
            </div>
        </div>
    );
}

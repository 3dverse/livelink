//-----------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";

//-----------------------------------------------------------------------------
export const PerformancePanel = () => {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);
    const [, setRedrawTrigger] = useState(true);

    //--------------------------------------------------------------------------
    // Force redraw for live performance metrics
    useEffect(() => {
        if (!instance) {
            return;
        }
        const interval = setInterval(() => {
            setRedrawTrigger(trigger => !trigger);
        }, 300);

        return () => {
            clearInterval(interval);
        };
    }, [instance]);

    //--------------------------------------------------------------------------
    if (!instance) {
        return null;
    }

    //--------------------------------------------------------------------------
    // Workaround the gap when the frames streaming is suspended because the
    // rendering remains static: set the minimum value to 1 FPS.
    let { frame_dt, latency } = instance;
    frame_dt = Math.min(1000, frame_dt);
    const fps = frame_dt ? (1000 / frame_dt).toFixed(0) : 0;

    //--------------------------------------------------------------------------
    return (
        <div
            role="perf-metrics"
            className="
                flex flex-col items-start gap-1 p-3 w-36
                bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)] backdrop-blur-xl rounded-lg 
                shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)] 
                text-xs
            "
        >
            <div className="flex justify-between w-full">
                <span>Latency</span>
                <span>{latency.toFixed(0)} ms</span>
            </div>
            <div className="flex justify-between w-full">
                <span>Frame dt</span>
                <span>{frame_dt} ms</span>
            </div>
            <div className="flex justify-between w-full">
                <span>FPS</span>
                <span>{fps}</span>
            </div>
        </div>
    );
};

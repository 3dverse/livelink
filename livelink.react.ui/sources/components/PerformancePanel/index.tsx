//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { Skeleton } from "../../components-common/Skeleton";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const PerformancePanel = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
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
        return (
            <div
                className={`${styles.container} ${className ?? ""} livelink-react-ui-component`}
                style={{ width: "100%", ...style }}
            >
                {[1, 2, 3].map(index => (
                    <p key={index} className={styles.indicator}>
                        <Skeleton style={{ width: "60%" }} />
                        <Skeleton style={{ width: "20%" }} />
                    </p>
                ))}
            </div>
        );
    }

    //--------------------------------------------------------------------------
    // Workaround the gap when the frames streaming is suspended because the
    // rendering remains static: set the minimum value to 1 FPS.
    let { frame_dt, latency } = instance;
    frame_dt = Math.min(1000, frame_dt);
    const fps = frame_dt ? (1000 / frame_dt).toFixed(0) : 0;

    const indicators = [
        { label: "Latency", value: latency.toFixed(0) },
        { label: "Frame dt", value: frame_dt },
        { label: "FPS", value: fps },
    ];

    //--------------------------------------------------------------------------
    return (
        <div
            role="status"
            className={`${styles.container} ${className ?? ""} livelink-react-ui-component`}
            style={style}
        >
            {indicators.map(({ label, value }) => (
                <p key={label} className={styles.indicator}>
                    <span>{label}</span>
                    <span className={styles.value}>{value}</span>
                </p>
            ))}
        </div>
    );
};

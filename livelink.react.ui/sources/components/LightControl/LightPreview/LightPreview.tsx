//------------------------------------------------------------------------------
import React from "react";
import { useLightControl } from "../LightControlContext";
import styles from "./lightPreview.module.css";

//------------------------------------------------------------------------------
export const LightPreview = () => {
    //--------------------------------------------------------------------------
    const { isPowered, color, intensity, intensityMax } = useLightControl();

    //--------------------------------------------------------------------------
    return (
        <div
            className={`${styles.lightPreviewContainer} ${!isPowered ? styles.dimmed : ""}`}
            style={
                {
                    "--color": color,
                    "--intensity": Math.min(Math.max(0, easeOutExpo(intensity / intensityMax)), 1),
                } as React.CSSProperties
            }
        >
            <span className={styles.lightCable} />
            <div className={styles.outerBox}>
                {isPowered && <div role="presentation" className={styles.innerGlow} />}
            </div>
            <span />
        </div>
    );
};

//------------------------------------------------------------------------------
function easeOutExpo(x: number): number {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

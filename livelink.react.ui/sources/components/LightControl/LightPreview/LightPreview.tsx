//------------------------------------------------------------------------------
import React from "react";
import styles from "./lightPreview.module.css";

//------------------------------------------------------------------------------
export const LightPreview = ({
    isPowered,
    color,
    intensity,
    intensityMax,
}: {
    isPowered: boolean;
    color: string;
    intensity: number;
    intensityMax: number;
}) => {
    return (
        <div className={styles.lightPreviewContainer}>
            <div
                className={`${styles.outerBox} ${!isPowered ? styles.dimmed : ""}`}
                style={
                    {
                        "--color": color,
                        "--intensity": Math.min(Math.max(0, easeOutExpo(intensity / intensityMax)), 1),
                    } as React.CSSProperties
                }
            >
                {isPowered && <div role="presentation" className={styles.innerGlow} />}
            </div>
        </div>
    );
};

//------------------------------------------------------------------------------
function easeOutExpo(x: number): number {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

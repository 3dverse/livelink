//------------------------------------------------------------------------------
import React from "react";
import styles from "./lightPreview.module.css";

//------------------------------------------------------------------------------
export const LightPreview = ({
    isPowered,
    color,
    brightness,
    brightnessMax,
}: {
    isPowered: boolean;
    color: string;
    brightness: number;
    brightnessMax: number;
}) => {
    return (
        <div className={styles.lightPreviewContainer}>
            <div
                className={`${styles.outerBox} ${!isPowered ? styles.dimmed : ""}`}
                style={
                    {
                        "--color": color,
                        "--brightness": brightness,
                        "--brightness-max": brightnessMax,
                    } as React.CSSProperties
                }
            >
                {isPowered && <div role="presentation" className={styles.innerGlow} />}
            </div>
        </div>
    );
};

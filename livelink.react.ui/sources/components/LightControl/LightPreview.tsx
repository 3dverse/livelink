//------------------------------------------------------------------------------
import React from "react";
import { Vec3 } from "@3dverse/livelink";
import styles from "./lightPreview.module.css";
import { rgbToHex } from ".";

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
                        "--intensity": intensity,
                        "--intensity-max": intensityMax,
                    } as React.CSSProperties
                }
            >
                {isPowered && <div role="presentation" className={styles.innerGlow} />}
            </div>
        </div>
    );
};

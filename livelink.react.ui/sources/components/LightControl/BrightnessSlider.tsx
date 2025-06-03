//------------------------------------------------------------------------------
import React from "react";
import styles from "./brightnessSlider.module.css";
import { Slider } from "../../components-common/Slider";

//------------------------------------------------------------------------------
export const BrightnessSlider = ({
    brightness,
    brightnessMax,
    onChange,
    color,
}: {
    brightness: number;
    brightnessMax: number;
    onChange: (value: number) => void;
    color: string;
}) => {
    return (
        <div className={styles.brightnessSliderContainer}>
            <label className={styles.label}>Brightness</label>
            <Slider
                min={0}
                max={20}
                step={0.1}
                color={color}
                value={brightness}
                onChange={onChange}
                style={
                    {
                        "--track-color": color,
                        "--track-opacity": brightness / brightnessMax,
                    } as React.CSSProperties
                }
            />
        </div>
    );
};

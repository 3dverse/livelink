//------------------------------------------------------------------------------
import React from "react";
import styles from "./intensitySlider.module.css";
import { Slider } from "../../components-common/Slider";

//------------------------------------------------------------------------------
export const IntensitySlider = ({
    intensity,
    intensityMax,
    onChange,
    color,
}: {
    intensity: number;
    intensityMax: number;
    onChange: (value: number) => void;
    color: string;
}) => {
    return (
        <div className={styles.intensitySliderContainer}>
            <label className={styles.label}>Brightness</label>
            <Slider
                min={0}
                max={20}
                step={0.1}
                color={color}
                value={intensity}
                onChange={onChange}
                style={
                    {
                        "--track-color": color,
                        "--track-opacity": intensity / intensityMax,
                    } as React.CSSProperties
                }
            />
        </div>
    );
};

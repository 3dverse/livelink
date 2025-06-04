//------------------------------------------------------------------------------
import React from "react";
import styles from "./intensitySlider.module.css";
import { Slider } from "../../components-common/Slider";

//------------------------------------------------------------------------------
export const IntensitySlider = ({
    color,
    intensity,
    intensityMin,
    intensityMax,
    intensityStep,
    onChange,
}: {
    color: string;
    intensity: number;
    intensityMin: number;
    intensityMax: number;
    intensityStep: number;
    onChange: (value: number) => void;
}) => {
    return (
        <div className={styles.intensitySliderContainer}>
            <label className={styles.label}>Brightness</label>
            <Slider
                min={intensityMin}
                max={intensityMax}
                step={intensityStep}
                color={color}
                value={intensity}
                onChange={onChange}
                style={
                    {
                        "--track-color": color,
                        "--track-opacity": intensity / intensityMax,
                    } as React.CSSProperties
                }
                animateValueChange
            />
        </div>
    );
};

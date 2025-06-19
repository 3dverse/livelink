//------------------------------------------------------------------------------
import React from "react";
import { useLightControl } from "../LightControlContext";
import { Slider } from "../../../components-common/Slider";

//------------------------------------------------------------------------------
export const LightBrightnessSlider = ({ className }: { className?: string }) => {
    const { intensity, intensityMin, intensityMax, intensityStep, color, onIntensityChange } = useLightControl();
    return (
        <Slider
            min={intensityMin}
            max={intensityMax}
            step={intensityStep}
            color={color}
            value={intensity}
            valueDecimals={1}
            onChange={onIntensityChange}
            style={
                {
                    "--track-color": color,
                    "--track-opacity": intensity / intensityMax,
                } as React.CSSProperties
            }
            animateValueChange
            className={className}
        />
    );
};

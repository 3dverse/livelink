//------------------------------------------------------------------------------
import React from "react";
import { useLightControl } from "../LightControlContext";
import { TemperatureSlider } from "../../../components-common/TemperatureSlider";

//------------------------------------------------------------------------------
export const LightTemperatureSlider = ({ className }: { className?: string }) => {
    const { temperature, onTemperatureChange } = useLightControl();
    return (
        <TemperatureSlider
            value={temperature ?? 0}
            hideValue={!temperature}
            onChange={onTemperatureChange}
            animateValueChange
            className={className}
        />
    );
};

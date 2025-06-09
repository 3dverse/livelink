//------------------------------------------------------------------------------
import React from "react";
import { Slider } from "../Slider";

//------------------------------------------------------------------------------
export interface TemperatureSliderProps {
    min?: number;
    max?: number;
    step?: number;
    value: number;
    hideValue?: boolean;
    onChange: (value: number, color: string) => void;
    animateValueChange?: boolean;
}

//------------------------------------------------------------------------------
export const TemperatureSlider = ({
    min = 2000,
    max = 10000,
    step = 100,
    value,
    hideValue = false,
    onChange,
    animateValueChange = false,
}: TemperatureSliderProps) => {
    //--------------------------------------------------------------------------
    const handleChange = (newValue: number) => {
        const newColor = kelvinToHex(newValue);
        onChange?.(newValue, newColor);
    };

    //--------------------------------------------------------------------------
    return (
        <Slider
            min={min}
            max={max}
            step={step}
            trackStyle={{
                background: `linear-gradient(to right,
                    ${kelvinToHex(2000)},
                    ${kelvinToHex(3000)},
                    ${kelvinToHex(4000)},
                    ${kelvinToHex(5500)},
                    ${kelvinToHex(6500)},
                    ${kelvinToHex(8000)},
                    ${kelvinToHex(10000)}
                  )`,
            }}
            filledTrackStyle={{
                backgroundColor: "transparent",
            }}
            thumbStyle={{
                backgroundColor: value ? kelvinToHex(value) : "transparent",
                opacity: hideValue ? 0 : 1,
            }}
            valueStyle={{
                opacity: hideValue ? 0 : 1,
            }}
            value={value}
            unit=" K"
            onChange={newValue => handleChange(newValue)}
            animateValueChange={animateValueChange}
        />
    );
};

//------------------------------------------------------------------------------
export function kelvinToHex(kelvin: number): string {
    const temp = kelvin / 100;
    let red: number, green: number, blue: number;

    if (temp <= 66) {
        red = 255;
        green = 99.4708025861 * Math.log(temp) - 161.1195681661;
        blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
        red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
        green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
        blue = 255;
    }

    const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
    const toHex = (c: number) => clamp(c).toString(16).padStart(2, "0");

    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

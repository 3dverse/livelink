//------------------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LightControlContext } from "./LightControlContext";

//------------------------------------------------------------------------------
export type LightControlProps = {
    light: Entity;
    intensityMin?: number;
    intensityMax?: number;
    intensityStep?: number;
    className?: string;
    children?: React.ReactNode;
};
//------------------------------------------------------------------------------
export const LightControl = ({
    light,
    intensityMin = 0,
    intensityMax = 20,
    intensityStep = 0.1,
    className,
    children,
}: LightControlProps) => {
    //--------------------------------------------------------------------------
    const [color, setColor] = useState<string>(rgbToHex(light.point_light!.color));
    const [temperature, setTemperature] = useState<number | null>(null); // kelvin value
    const [intensity, setIntensity] = useState<number>(light.point_light!.intensity);
    const [isPowered, setIsPowered] = useState<boolean>(light.is_visible);

    //--------------------------------------------------------------------------
    // Effects
    useEffect(() => {
        if (!light.point_light) {
            return;
        }
        setColor(rgbToHex(light.point_light.color));
        setIntensity(light.point_light.intensity);
        setIsPowered(light.is_visible);
    }, [light.point_light?.intensity, light.point_light?.color, light.is_visible]);

    //--------------------------------------------------------------------------
    // Handlers
    const onColorChange = (color: string) => {
        light.point_light!.color = hexToRgb(color.substring(1));
        setTemperature(null);
        setColor(color);
    };

    const onIntensityChange = (intensity: number) => {
        light.point_light!.intensity = intensity;
        setIntensity(intensity);
    };

    const onPowerChange = (isPowered: boolean) => {
        light.is_visible = isPowered;
        setIsPowered(isPowered);
    };

    const onTemperatureChange = (temperature: number, color: string) => {
        setTemperature(temperature);
        light.point_light!.color = hexToRgb(color.substring(1));
        setColor(color);
    };

    //--------------------------------------------------------------------------
    // UI
    if (!light.point_light) {
        // TODO: add a feedback in UI
        return null;
    }
    return (
        <LightControlContext.Provider
            value={{
                light,
                color,
                temperature,
                intensity,
                intensityMin,
                intensityMax,
                intensityStep,
                isPowered,
                onColorChange,
                onIntensityChange,
                onPowerChange,
                onTemperatureChange,
            }}
        >
            <div className={`livelink-react-ui-component ${className ?? ""}`}>{children}</div>
        </LightControlContext.Provider>
    );
};

//------------------------------------------------------------------------------
function toHex(c: number) {
    const hex = (c * 255).toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

//------------------------------------------------------------------------------
function rgbToHex(c: Vec3) {
    return "#" + toHex(c[0]) + toHex(c[1]) + toHex(c[2]);
}

//------------------------------------------------------------------------------
function hexToRgb(h: string): Vec3 {
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
}

import { createContext, useContext } from "react";
import { Entity } from "@3dverse/livelink";

type LightControlContextType = {
    light: Entity;
    color: string;
    intensity: number;
    intensityMin: number;
    intensityMax: number;
    intensityStep: number;
    temperature: number | null;
    isPowered: boolean;
    onColorChange: (color: string) => void;
    onIntensityChange: (intensity: number) => void;
    onTemperatureChange: (temp: number, color: string) => void;
    onPowerChange: (isPowered: boolean) => void;
};

export const LightControlContext = createContext<LightControlContextType | null>(null);

export const useLightControl = () => {
    const ctx = useContext(LightControlContext);
    if (!ctx) throw new Error("useLightControl must be used within <LightControl>");
    return ctx;
};

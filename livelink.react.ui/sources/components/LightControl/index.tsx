//------------------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { Entity, Vec3 } from "@3dverse/livelink";
import clsx from "clsx";

//------------------------------------------------------------------------------
import { Slider } from "../../components-common/Slider";
import { TemperatureSlider } from "../../components-common/TemperatureSlider";
import { LightPreview } from "./LightPreview/LightPreview";
import { ColorSelector } from "./ColorSelector/ColorSelector";
import { SwitchOnOff } from "./SwitchOnOff/SwitchOnOff";

import styles from "./index.module.css";

//------------------------------------------------------------------------------
export const LightControl = ({
    light,
    intensityMin = 0,
    intensityMax = 20,
    intensityStep = 0.1,
}: {
    light: Entity;
    intensityMin?: number;
    intensityMax?: number;
    intensityStep?: number;
}) => {
    //--------------------------------------------------------------------------
    const [color, setColor] = useState<string>(rgbToHex(light.point_light!.color));
    const [temperature, setTemperature] = useState<number | null>(null); // kelvin value
    const [intensity, setIntensity] = useState<number>(light.point_light!.intensity);
    const [savedIntensity, setSavedIntensity] = useState<number>(intensity);
    const [isPowered, setIsPowered] = useState<boolean>(true);

    //--------------------------------------------------------------------------
    // Effects
    useEffect(() => {
        if (!light.point_light) {
            return;
        }
        setColor(rgbToHex(light.point_light!.color));
        setIntensity(light.point_light!.intensity);
        if (!isPowered && light.point_light!.intensity > 0) {
            setIsPowered(true);
        }
    }, [light.point_light?.intensity, light.point_light?.color]);

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
        if (!isPowered) {
            setSavedIntensity(intensity);
            light.point_light!.intensity = 0;
        } else {
            light.point_light!.intensity = savedIntensity;
        }
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
        <div className={`${styles.container} livelink-react-ui-component`}>
            <LightPreview color={color} intensity={intensity} intensityMax={intensityMax} isPowered={isPowered} />
            <div className={styles.innerContainer}>
                <Card
                    isPowered={isPowered}
                    style={{ flexDirection: "column", gap: "var(--3dverse-spacing-4)", flexGrow: 1 }}
                >
                    <ColorSelector value={color} onChange={onColorChange} />
                    <div>
                        <label className={styles.label}>Temperature</label>
                        <TemperatureSlider
                            value={temperature ?? 0}
                            hideValue={!temperature}
                            onChange={onTemperatureChange}
                            animateValueChange
                        />
                    </div>
                    <div>
                        <label className={styles.label}>Brightness</label>
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
                        />
                    </div>
                </Card>
                <Card style={{ justifyContent: "end", alignItems: "end" }}>
                    <SwitchOnOff isPowered={isPowered} onChange={onPowerChange} />
                </Card>
            </div>
        </div>
    );
};

//------------------------------------------------------------------------------
const Card = ({
    children,
    className,
    isPowered = true,
    ...props
}: { isPowered?: boolean; children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
    <div className={clsx(styles.card, isPowered ? "" : styles.dimmed, className)} {...props}>
        {children}
    </div>
);

//------------------------------------------------------------------------------
function toHex(c: number) {
    const hex = (c * 255).toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

//------------------------------------------------------------------------------
export function rgbToHex(c: Vec3) {
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

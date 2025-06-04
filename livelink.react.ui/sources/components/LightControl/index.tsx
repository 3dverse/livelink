//------------------------------------------------------------------------------
import React, { useState } from "react";
import { Entity, Vec3 } from "@3dverse/livelink";
import clsx from "clsx";

//------------------------------------------------------------------------------
import { LightPreview } from "./LightPreview";
import { ColorsSelector } from "./ColorsSelector";
import { IntensitySlider } from "./IntensitySlider";
import { SwitchOnOff } from "./SwitchOnOff";

import styles from "./index.module.css";

//------------------------------------------------------------------------------
export const LightControl = ({
    light,
    intensityMin = 0,
    intensityMax = 20,
}: {
    light: Entity;
    intensityMin?: number;
    intensityMax?: number;
}) => {
    //--------------------------------------------------------------------------
    const [color, setColor] = useState<string>(rgbToHex(light.point_light!.color));
    const [intensity, setIntensity] = useState<number>(light.point_light!.intensity);
    const [isPowered, setIsPowered] = useState<boolean>(light.point_light!.intensity !== 0);

    //--------------------------------------------------------------------------
    // Handlers
    const onColorChange = (color: string) => {
        light.point_light!.color = hexToRgb(color.substring(1));
        setColor(color);
    };

    const onIntensityChange = (intensity: number) => {
        light.point_light!.intensity = intensity;
        setIntensity(intensity);
    };

    const onPowerChange = (isPowered: boolean) => {
        if (!isPowered) {
            light.point_light!.intensity = 0;
        } else {
            light.point_light!.intensity = intensity;
        }
        setIsPowered(isPowered);
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
                <Card isPowered={isPowered}>
                    <ColorsSelector value={color} onChange={onColorChange} />
                </Card>
                <Card isPowered={isPowered} style={{ flexGrow: 1 }}>
                    <IntensitySlider
                        intensity={intensity}
                        intensityMax={intensityMax}
                        onChange={onIntensityChange}
                        color={color}
                    />
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

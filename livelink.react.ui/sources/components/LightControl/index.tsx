//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import { Entity, Vec3 } from "@3dverse/livelink";
import clsx from "clsx";

//------------------------------------------------------------------------------
import { LightPreview } from "./LightPreview";
import { ColorsSelector } from "./ColorsSelector";
import { BrightnessSlider } from "./BrightnessSlider";
import { SwitchOnOff } from "./SwitchOnOff";

import styles from "./index.module.css";

//------------------------------------------------------------------------------
const lightDefaultValues = {
    color: "#FFFFFF",
    brightness: 0,
    isPowered: true,
};
const brightnessMax = 20;

//------------------------------------------------------------------------------
type LightEntity = Entity & { point_light: { color: Vec3; intensity: number } };

//------------------------------------------------------------------------------
export const LightControl = ({ lights: _lights, onChange }: { lights?: LightEntity[]; onChange?: () => void }) => {
    //--------------------------------------------------------------------------
    const { instance } = useContext(LivelinkContext);

    //--------------------------------------------------------------------------
    // States
    const [lights, setLights] = useState<LightEntity[]>(_lights || []);
    const [lightValues, setLightValues] = useState<typeof lightDefaultValues>(lightDefaultValues);

    //--------------------------------------------------------------------------
    // Effects
    useEffect(() => {
        if (!_lights) {
            instance?.scene
                .findEntitiesWithComponents({
                    mandatory_components: ["point_light"],
                })
                .then(entities => {
                    const __lights = entities.filter(entity => !entity.point_light?.isSun);
                    setLights(__lights as LightEntity[]);
                    console.log("lights", __lights[0].point_light);
                });
        }
    }, [instance, _lights]);

    //--------------------------------------------------------------------------
    // If only one light, set light values
    useEffect(() => {
        if (lights.length !== 1) return;
        setLightValues({
            color: rgbToHex(lights[0].point_light.color),
            brightness: lights[0].point_light.intensity,
            isPowered: true,
        });
    }, [lights]);

    //--------------------------------------------------------------------------
    // Handlers
    const onColorChange = (color: string) => {
        setLightValues({ ...lightValues, color });
        const _color = lightValues.isPowered ? hexToRgb(color) : hexToRgb("#000000");
        lights.forEach(light => {
            light.point_light.color = _color;
        });
        onChange?.();
    };

    const onBrightnessChange = (brightness: number) => {
        setLightValues({ ...lightValues, brightness });
        lights.forEach(light => {
            light.point_light.intensity = lightValues.brightness * 10;
        });
        onChange?.();
    };

    const onPowerChange = (isPowered: boolean) => {
        setLightValues({ ...lightValues, isPowered });
        const _color = !lightValues.isPowered ? hexToRgb(lightValues.color) : hexToRgb("#000000");
        lights.forEach(light => {
            light.point_light.color = _color;
        });
        onChange?.();
    };

    //--------------------------------------------------------------------------
    // UI
    if (!lights || lights.length === 0) return null;
    return (
        <div className={`${styles.container} livelink-react-ui-component`}>
            <LightPreview
                color={lightValues.color}
                brightness={lightValues.brightness}
                brightnessMax={brightnessMax}
                isPowered={lightValues.isPowered}
            />
            <div className={styles.innerContainer}>
                <Card isPowered={lightValues.isPowered}>
                    <ColorsSelector value={lightValues.color} onChange={onColorChange} />
                </Card>
                <Card isPowered={lightValues.isPowered} style={{ flexGrow: 1 }}>
                    <BrightnessSlider
                        brightness={lightValues.brightness}
                        brightnessMax={brightnessMax}
                        onChange={onBrightnessChange}
                        color={lightValues.color}
                    />
                </Card>
                <Card style={{ justifyContent: "end", alignItems: "end" }}>
                    <SwitchOnOff isPowered={lightValues.isPowered} onChange={onPowerChange} />
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

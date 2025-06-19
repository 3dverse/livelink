//------------------------------------------------------------------------------
import React from "react";
import { useLightControl } from "../LightControlContext";
import { lightColors } from "./lightColors";
import styles from "./lightColorSelector.module.css";

//------------------------------------------------------------------------------
export const LightColorSelector = ({ className }: { className?: string }) => {
    //--------------------------------------------------------------------------
    const { color, onColorChange } = useLightControl();
    const isCustomColor = !lightColors.some(lightColor => lightColor.toLowerCase() === color.toLowerCase());

    //--------------------------------------------------------------------------
    return (
        <div className={`${styles.colorSelector} ${className ?? ""}`}>
            {lightColors.map((lightColor, index) => (
                <button
                    key={index}
                    className={`${styles.colorButton} ${!isCustomColor && lightColor.toLowerCase() === color.toLowerCase() ? styles.active : ""}`}
                    style={{
                        backgroundColor: lightColor,
                        borderColor: `color-mix(in srgb, ${lightColor} 80%, black)`,
                    }}
                    onClick={() => onColorChange(lightColor)}
                />
            ))}

            <label
                htmlFor="color-picker"
                className={`${styles.customColorButton} ${isCustomColor ? styles.active : ""}`}
                style={{
                    backgroundColor: color,
                }}
            >
                <input
                    type="color"
                    id="color-picker"
                    value={color}
                    onChange={e => onColorChange(e.target.value)}
                    className={styles.colorInput}
                />
                <span className={styles.plus}>+</span>
            </label>
        </div>
    );
};

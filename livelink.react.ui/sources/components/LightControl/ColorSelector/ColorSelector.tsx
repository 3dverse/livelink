//------------------------------------------------------------------------------
import React from "react";
import styles from "./colorSelector.module.css";
import { colors } from "./colors";

//------------------------------------------------------------------------------
export const ColorSelector = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    const isCustomColor = !colors.some(color => color.toLowerCase() === value.toLowerCase());

    return (
        <div className={styles.colorSelector}>
            {colors.map((color, index) => (
                <button
                    key={index}
                    className={`${styles.colorButton} ${!isCustomColor && value.toLowerCase() === color.toLowerCase() ? styles.active : ""}`}
                    style={{
                        backgroundColor: color,
                        borderColor: `color-mix(in srgb, ${color} 80%, black)`,
                    }}
                    onClick={() => onChange(color)}
                />
            ))}

            <label
                htmlFor="color-picker"
                className={`${styles.customColorButton} ${isCustomColor ? styles.active : ""}`}
                style={{
                    backgroundColor: value,
                }}
            >
                <input
                    type="color"
                    id="color-picker"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className={styles.colorInput}
                />
                <span className={styles.plus}>+</span>
            </label>
        </div>
    );
};

//------------------------------------------------------------------------------
import React from "react";
import styles from "./colorSelector.module.css";

//------------------------------------------------------------------------------
const colors = [
    "#FF6B6B", // Soft Coral Red
    "#F7B267", // Warm Apricot
    "#FFD93D", // Golden Honey
    "#A3DE83", // Fresh Mint
    "#62BEC1", // Soft Teal
    "#5E60CE", // Calm Indigo
    "#A066F7", // Gentle Purple
    "#F48498", // Blush Pink
    "#9AD0EC", // Icy Blue
    "#F9C5D1", // Light Rose
    "#C4F0C5", // Pale Green
    // "#E6D0FA", // Lavender Mist
];

//------------------------------------------------------------------------------
export const ColorsSelector = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    return (
        <div className={styles.colorsSelector}>
            {colors.map((color, index) => (
                <button
                    key={index}
                    className={`${styles.colorButton} ${value === color ? styles.active : ""}`}
                    style={{
                        backgroundColor: color,
                        borderColor: `color-mix(in srgb, ${color} 80%, black)`,
                    }}
                    onClick={() => onChange(color)}
                />
            ))}

            <label
                htmlFor="color-picker"
                className={styles.customColorButton}
                style={{
                    backgroundColor: "color-mix(in srgb, var(--3dverse-color-bg-underground) 50%, transparent)",
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

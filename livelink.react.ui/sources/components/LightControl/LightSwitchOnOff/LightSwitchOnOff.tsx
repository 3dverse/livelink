//------------------------------------------------------------------------------
import React from "react";
import { useLightControl } from "../LightControlContext";
import styles from "./lightSwitchOnOff.module.css";

//------------------------------------------------------------------------------
export const LightSwitchOnOff = ({ className }: { className?: string }) => {
    const { isPowered, onPowerChange } = useLightControl();
    return (
        <button className={`${styles.toggleButton} ${className ?? ""}`} onClick={() => onPowerChange(!isPowered)}>
            <span className={styles.toggleText} style={{ opacity: isPowered ? 1 : 0.4 }}>
                ON
            </span>
            <span className={styles.toggleText} style={{ opacity: !isPowered ? 1 : 0.4 }}>
                OFF
            </span>
        </button>
    );
};

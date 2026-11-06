//------------------------------------------------------------------------------
import React from "react";
import { useLightControl } from "../LightControlContext";
import styles from "./lightSwitchOnOff.module.css";

//------------------------------------------------------------------------------
export const LightSwitchOnOff = ({ className }: { className?: string }) => {
    const { isPowered, onPowerChange } = useLightControl();
    return (
        <button
            data-state={isPowered ? "on" : "off"}
            className={`${styles.toggleButton} ${className ?? ""}`}
            onClick={() => onPowerChange(!isPowered)}
        >
            <span data-slot="on">ON</span>
            <span data-slot="off">OFF</span>
        </button>
    );
};

//------------------------------------------------------------------------------
import React from "react";
import styles from "./switchOnOff.module.css";

//------------------------------------------------------------------------------
export const SwitchOnOff = ({
    isPowered,
    onChange,
}: {
    isPowered: boolean;
    onChange: (isPowered: boolean) => void;
}) => {
    return (
        <button className={styles.toggleButton} onClick={() => onChange(!isPowered)}>
            <span className={styles.toggleText} style={{ opacity: isPowered ? 1 : 0.4 }}>
                ON
            </span>
            <span className={styles.toggleText} style={{ opacity: !isPowered ? 1 : 0.4 }}>
                OFF
            </span>
        </button>
    );
};

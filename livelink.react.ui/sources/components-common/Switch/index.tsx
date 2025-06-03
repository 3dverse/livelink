//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import { Size } from "../Input";
import styles from "./index.module.css";

//------------------------------------------------------------------------------
type SwitchProps = {
    id?: string;
    label?: string;
    size?: Size;
    isChecked: boolean;
    isDisabled?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

//------------------------------------------------------------------------------
export const Switch: React.FC<SwitchProps> = ({ id, label, size = "md", isChecked, isDisabled, onChange }) => {
    return (
        <label className={clsx(styles.wrapper, styles[size])} htmlFor={id}>
            {label && <span>{label}</span>}
            <input
                id={id}
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={onChange}
                className={styles.switchInput}
            />
            <span className={styles.switchTrack}>
                <span className={styles.switchThumb} />
            </span>
        </label>
    );
};

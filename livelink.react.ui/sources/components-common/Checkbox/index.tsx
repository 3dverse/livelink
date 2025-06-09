//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import styles from "./index.module.css";
import { Size } from "../Input";

//------------------------------------------------------------------------------
type CheckboxProps = {
    id?: string;
    label?: string;
    name?: string;
    title?: string;
    size?: Size;
    isChecked: boolean;
    isDisabled?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    children?: React.ReactNode;
};

//------------------------------------------------------------------------------
export const Checkbox: React.FC<CheckboxProps> = ({
    id,
    label,
    name,
    title,
    size = "md",
    isChecked,
    isDisabled,
    onChange,
    children,
}) => {
    return (
        <label className={clsx(styles.wrapper, styles[size])} htmlFor={id}>
            <input
                id={id}
                type="checkbox"
                name={name}
                title={title}
                checked={isChecked}
                disabled={isDisabled}
                onChange={onChange}
                className={styles.input}
            />
            <span className={styles.box}>
                <svg viewBox="0 0 24 24" className={styles.icon}>
                    <polyline points="4 12 9 17 20 6" />
                </svg>
            </span>
            {(label || children) && <span className={styles.labelText}>{label || children}</span>}
        </label>
    );
};

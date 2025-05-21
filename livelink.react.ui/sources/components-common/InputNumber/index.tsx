//------------------------------------------------------------------------------
import React, { ChangeEvent } from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import stylesInput from "../Input/style.module.css";
import { Size } from "../Input";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const InputNumber = ({
    id,
    size = "md",
    value,
    placeholder,
    onChange,
    className,
}: {
    id?: string;
    size?: Size;
    value: number;
    placeholder?: string;
    onChange: (event: ChangeEvent<HTMLInputElement>, value: number) => void;
    className?: string;
}) => {
    //------------------------------------------------------------------------------
    if (!value) return null;
    //------------------------------------------------------------------------------
    return (
        <input
            id={id}
            type="number"
            className={clsx(stylesInput.input, styles.inputNumber, stylesInput[size], className)}
            placeholder={placeholder}
            value={value}
            onChange={event => onChange(event, Number(event.target.value))}
        />
    );
};

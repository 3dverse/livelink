//------------------------------------------------------------------------------
import React, { ChangeEvent } from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import stylesInput from "../Input/style.module.css";
import { Size } from "../Input";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const InputVector = ({
    id,
    type,
    size = "md",
    value,
    placeholder,
    onChange,
    className,
}: {
    id?: string;
    type: string;
    size?: Size;
    value: number[];
    placeholder?: number[];
    onChange: (event: ChangeEvent<HTMLInputElement>, value: number[]) => void;
    className?: string;
}) => {
    //------------------------------------------------------------------------------
    if (!value) return null;
    //------------------------------------------------------------------------------
    return (
        <div className={clsx(styles.inputs, className)}>
            {value.map((val: number, index: number) => (
                <input
                    key={index}
                    type="number"
                    id={id}
                    className={clsx(stylesInput.input, styles.inputVector, stylesInput[size])}
                    style={{
                        borderTopLeftRadius: index === 0 ? "var(--3dverse-border-radius-lg)" : undefined,
                        borderTopRightRadius:
                            (index === value.length - 1 && value.length <= 4) || (type === "mat4" && index === 3)
                                ? "var(--3dverse-border-radius-lg)"
                                : undefined,
                        borderBottomLeftRadius:
                            (index === 0 && value.length <= 4) || (type === "mat4" && index === 12)
                                ? "var(--3dverse-border-radius-lg)"
                                : undefined,
                        borderBottomRightRadius:
                            index === value.length - 1 ? "var(--3dverse-border-radius-lg)" : undefined,
                    }}
                    pattern="[0-9]"
                    placeholder={String(placeholder?.[index])}
                    value={val}
                    onChange={event => {
                        value[index] = Number(event.target.value);
                        onChange(event, value);
                    }}
                />
            ))}
        </div>
    );
};

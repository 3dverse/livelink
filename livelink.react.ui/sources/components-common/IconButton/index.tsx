//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import buttonStyles from "../Button/style.module.css";
import { Size, Variant } from "../Button";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon: React.ReactNode;
    isDisabled?: boolean;
}

//------------------------------------------------------------------------------
export const IconButton: React.FC<IconButtonProps> = ({
    variant = "ghost",
    size = "md",
    icon,
    className,
    isDisabled = false,
    children,
    ...props
}) => {
    return (
        <button
            className={clsx(
                buttonStyles.button,
                styles.iconButton,
                buttonStyles[variant],
                styles[variant],
                buttonStyles[size],
                styles[size],
                className,
            )}
            disabled={isDisabled}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
};

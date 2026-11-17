//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import buttonStyles from "../Button/index.module.css";
import { type ButtonSize, type ButtonVariant } from "../Button";
import styles from "./index.module.css";

//------------------------------------------------------------------------------
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
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

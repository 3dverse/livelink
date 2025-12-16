//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
export type Variant = "ghost" | "secondary" | "outline";
export type Size = "3xs" | "2xs" | "xs" | "sm" | "md";

//------------------------------------------------------------------------------
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
}

//------------------------------------------------------------------------------
export const Button: React.FC<ButtonProps> = ({ variant = "ghost", size = "md", className, children, ...props }) => {
    return (
        <button className={clsx(styles.button, styles[variant], styles[`button-${size}`], className)} {...props}>
            {children}
        </button>
    );
};

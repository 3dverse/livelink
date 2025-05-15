//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export type Size = "xs" | "sm" | "md";

//------------------------------------------------------------------------------
interface IconProps extends React.SVGProps<SVGSVGElement> {
    as?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    size?: Size;
}

//------------------------------------------------------------------------------
export const Icon: React.FC<IconProps> = ({ as, size = "md", className, ...props }) => {
    const As = as ?? "svg";
    return <As className={clsx(styles.icon, styles[size], className)} {...props} />;
};

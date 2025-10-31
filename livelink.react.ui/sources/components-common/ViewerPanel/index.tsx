//------------------------------------------------------------------------------
import React, { ReactNode } from "react";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
export const ViewerPanel = ({
    variant = "default",
    children,
    style,
    className,
}: {
    variant?: "default" | "outline";
    children: ReactNode;
    style?: React.CSSProperties;
    className?: string;
}) => {
    return (
        <div
            className={`${styles.wrapper} ${className ?? ""} ${styles[variant] ?? ""} livelink-react-ui-component`}
            style={style}
        >
            {children}
        </div>
    );
};

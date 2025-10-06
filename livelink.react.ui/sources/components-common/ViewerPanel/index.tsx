//------------------------------------------------------------------------------
import React, { ReactNode } from "react";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
export const ViewerPanel = ({
    children,
    style,
    className,
}: {
    children: ReactNode;
    style?: React.CSSProperties;
    className?: string;
}) => {
    return (
        <div className={`${styles.wrapper} ${className ?? ""}`} style={style}>
            {children}
        </div>
    );
};

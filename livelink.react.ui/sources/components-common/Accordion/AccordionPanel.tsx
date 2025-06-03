//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
export const AccordionPanel: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}> = ({ children, className, style }) => {
    //--------------------------------------------------------------------------
    return (
        <div className={clsx(styles.panel, className)} style={style}>
            {children}
        </div>
    );
};

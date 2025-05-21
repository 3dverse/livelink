//------------------------------------------------------------------------------
import React, { ReactNode } from "react";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
interface TooltipProps {
    label: string;
    isDisabled?: boolean;
    children: ReactNode;
}

//------------------------------------------------------------------------------
export const Tooltip: React.FC<TooltipProps> = ({ label, isDisabled, children }) => {
    if (isDisabled) {
        return children;
    }
    return (
        <span className={styles.wrapper}>
            {children}
            <span role="tooltip" className={styles.tooltipContent}>
                {label}
            </span>
        </span>
    );
};

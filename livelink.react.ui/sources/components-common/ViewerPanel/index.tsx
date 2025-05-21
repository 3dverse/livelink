//------------------------------------------------------------------------------
import React, { ReactNode } from "react";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const ViewerPanel = ({ children, className }: { children: ReactNode; className?: string }) => {
    return <div className={`${styles.wrapper} ${className}`}>{children}</div>;
};

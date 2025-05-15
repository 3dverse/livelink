//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const AccordionButton: React.FC<{
    isExpandable?: boolean;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}> = ({ isExpandable = true, children, className, style }) => {
    //--------------------------------------------------------------------------
    const As = isExpandable ? "summary" : "div";

    //--------------------------------------------------------------------------
    return (
        <As className={clsx(styles.button, className)} style={style}>
            {children}
        </As>
    );
};

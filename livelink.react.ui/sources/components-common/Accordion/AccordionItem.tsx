//------------------------------------------------------------------------------
import React from "react";
import clsx from "clsx";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const AccordionItem: React.FC<{
    isExpandable?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}> = ({ isExpandable = true, style, className, children }) => {
    //--------------------------------------------------------------------------
    const As = isExpandable ? "details" : "div";

    //--------------------------------------------------------------------------
    return (
        <As className={clsx(styles.item, className)} style={style}>
            {children}
        </As>
    );
};

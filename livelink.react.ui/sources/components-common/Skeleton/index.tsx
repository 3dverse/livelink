//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
export const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
    //--------------------------------------------------------------------------
    return (
        <span
            role="presentation"
            className={`livelink-react-ui-component ${styles.skeleton} ${className ?? ""}`}
            style={style}
        />
    );
};

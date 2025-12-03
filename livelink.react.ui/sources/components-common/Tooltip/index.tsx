//------------------------------------------------------------------------------
import React, { useRef, useState, useLayoutEffect } from "react";
import ReactDOM from "react-dom";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
type TooltipProps = {
    isVisible?: boolean;
    content: React.ReactNode;
    offset?: number;
    isDisabled?: boolean;
    children: React.ReactNode;
    usePortal?: boolean;
    variant?: "positive" | "negative" | "warning" | "info";
};

//------------------------------------------------------------------------------
export const Tooltip: React.FC<TooltipProps> = ({
    isVisible: isVisibleProp,
    content,
    offset = 8,
    isDisabled,
    children,
    usePortal = false,
    variant = "info",
}) => {
    //--------------------------------------------------------------------------
    const [isVisible, setIsVisible] = useState<boolean>(isVisibleProp ?? false);
    const [coords, setCoords] = useState({ left: 0, top: 0 });
    const ref = useRef<HTMLDivElement>(null);

    //--------------------------------------------------------------------------
    useLayoutEffect(() => {
        if (usePortal && ref.current && isVisible) {
            const rect = ref.current.getBoundingClientRect();
            setCoords({
                left: rect.left + rect.width / 2,
                top: window.scrollY + rect.top,
            });
        }
    }, [isVisible, usePortal]);

    //--------------------------------------------------------------------------
    const tooltip = (
        <div
            className={`${styles.tooltip} ${styles[variant]} ${usePortal ? styles.usePortal : ""} ${isVisible ? styles.visible : ""}`}
            style={
                usePortal
                    ? {
                          top: coords.top - offset,
                          left: coords.left,
                      }
                    : {}
            }
        >
            {content}
        </div>
    );

    //--------------------------------------------------------------------------
    if (!!!content || isDisabled) return children;
    return (
        <>
            <div
                ref={ref}
                className={styles.wrapper}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children}
                {!usePortal && tooltip}
            </div>
            {usePortal &&
                isVisible &&
                ReactDOM.createPortal(<div className="livelink-react-ui-component">{tooltip}</div>, document.body)}
        </>
    );
};

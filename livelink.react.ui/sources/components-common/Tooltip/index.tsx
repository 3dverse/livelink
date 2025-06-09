import React, { useRef, useState, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import styles from "./index.module.css";

//------------------------------------------------------------------------------
type TooltipProps = {
    content: React.ReactNode;
    isDisabled?: boolean;
    children: React.ReactNode;
    usePortal?: boolean;
};

//------------------------------------------------------------------------------
export const Tooltip: React.FC<TooltipProps> = ({ content, isDisabled, children, usePortal = false }) => {
    //--------------------------------------------------------------------------
    const [isVisible, setIsVisible] = useState(false);
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
            className={`${styles.tooltip} ${usePortal ? styles.usePortal : ""} ${isVisible ? styles.visible : ""} `}
            style={
                usePortal
                    ? {
                          top: coords.top - 8,
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

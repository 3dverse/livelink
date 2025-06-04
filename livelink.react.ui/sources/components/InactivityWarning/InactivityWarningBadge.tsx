//------------------------------------------------------------------------------
import React, { RefObject, useEffect } from "react";

//------------------------------------------------------------------------------
import { ViewerPanel } from "../../components-common/ViewerPanel";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const InactivityWarningBadge = ({
    timeLeft,
    onActivityReset,
    animatedPathRef,
    animatedOverlayRef,
}: {
    timeLeft: number;
    onActivityReset: () => void;
    animatedPathRef: RefObject<SVGPathElement | null>;
    animatedOverlayRef: RefObject<HTMLDivElement | null>;
}) => {
    //------------------------------------------------------------------------------
    useEffect(() => {
        window.addEventListener("click", onActivityReset);
        window.addEventListener("mousemove", onActivityReset);
        window.addEventListener("scroll", onActivityReset);
        window.addEventListener("touchstart", onActivityReset);
        return () => {
            window.removeEventListener("click", onActivityReset);
            window.removeEventListener("mousemove", onActivityReset);
            window.removeEventListener("scroll", onActivityReset);
            window.removeEventListener("touchstart", onActivityReset);
        };
    }, [onActivityReset]);

    //------------------------------------------------------------------------------
    return (
        <>
            <div ref={animatedOverlayRef} className={styles.overlay} />
            <aside className={styles.panelContainer}>
                <ViewerPanel className={styles.panel}>
                    <div className={styles.inner}>
                        <div className={styles.startLine} />
                        <svg className={styles.svgLine} viewBox="0 0 277 67" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M138.5 1H33.5C15.5507 1 1 15.5507 1 33.5V33.5C1 51.4493 15.5507 66 33.5 66H243.5C261.449 66 276 51.4493 276 33.5V33.5C276 15.5507 261.449 1 243.5 1H139"
                                strokeWidth={1}
                                style={{ stroke: "var(--3dverse-color-border-primary-alpha)" }}
                            />
                            <path
                                ref={animatedPathRef}
                                d="M138.5 1H33.5C15.5507 1 1 15.5507 1 33.5V33.5C1 51.4493 15.5507 66 33.5 66H243.5C261.449 66 276 51.4493 276 33.5V33.5C276 15.5507 261.449 1 243.5 1H139"
                                strokeWidth={1}
                                style={{
                                    strokeDasharray: 624,
                                    strokeDashoffset: 624,
                                    stroke: "var(--3dverse-color-accent)",
                                }}
                            />
                        </svg>
                        <p className={styles.label}>Move cursor to keep 3D view.</p>
                        <p className={styles.timerLabel}>
                            Closing in{" "}
                            <span className={styles.timer}>
                                {timeLeft > 9 ? (
                                    timeLeft.toString().padStart(2, "0")
                                ) : (
                                    <span style={{ paddingLeft: "8px" }}>{timeLeft}</span>
                                )}
                                s
                            </span>
                        </p>
                    </div>
                </ViewerPanel>
            </aside>
        </>
    );
};

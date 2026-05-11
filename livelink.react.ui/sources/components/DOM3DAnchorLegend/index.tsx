//------------------------------------------------------------------------------
import React, { PropsWithChildren } from "react";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export type DOM3DAnchorLegendDirection = "start" | "end";

//------------------------------------------------------------------------------
export type DOM3DAnchorLegendProps = PropsWithChildren<{
    className?: string;

    /**
     * Which way the legend extends relative to the world anchor.
     */
    direction?: DOM3DAnchorLegendDirection;
    /**
     * Color for caption text and lines.
     */
    color?: string;
}>;

/**
 * Legend-style label for use inside `DOM3DAnchor` (`@3dverse/livelink-react`).
 * Provides a corner bracket, anchor dot, and entrance motion suited to 3D DOM overlays.
 *
 * @category Components
 */
export function DOM3DAnchorLegend({
    children,
    className,
    direction = "start",
    color = "#000000",
}: DOM3DAnchorLegendProps): React.JSX.Element {
    //--------------------------------------------------------------------------
    const rootClass = [
        styles.root,
        direction === "end" ? styles.rootEnd : styles.rootStart,
        "livelink-react-ui-component",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const legendClass = [styles.legend, direction === "end" ? styles.legendEnd : styles.legendStart].join(" ");

    const cornerClass = [
        styles.cornerAccent,
        direction === "end" ? styles.cornerAccentEnd : styles.cornerAccentStart,
    ].join(" ");

    const dotClass = [styles.anchorDot, direction === "end" ? styles.anchorDotEnd : styles.anchorDotStart].join(" ");

    const rootStyle: React.CSSProperties | undefined =
        color !== undefined ? ({ ["--color"]: color } as React.CSSProperties) : undefined;

    //--------------------------------------------------------------------------
    return (
        <div className={rootClass} style={rootStyle}>
            <div className={legendClass}>
                {children}
                <span className={cornerClass} aria-hidden />
            </div>
            <span className={dotClass} aria-hidden />
        </div>
    );
}

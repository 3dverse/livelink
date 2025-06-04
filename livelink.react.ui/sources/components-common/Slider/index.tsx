//------------------------------------------------------------------------------
import React, { useRef, useState, useEffect } from "react";
import styles from "./index.module.css";

//------------------------------------------------------------------------------
export interface SliderProps {
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    value: number;
    onChange: (v: number) => void;
    color?: string;
    style?: React.CSSProperties;
    animateValueChange?: boolean; // When external users change the value, the slider is animated.
    trackStyle?: React.CSSProperties;
    filledTrackStyle?: React.CSSProperties;
    thumbStyle?: React.CSSProperties;
    valueStyle?: React.CSSProperties;
}

//------------------------------------------------------------------------------
export const Slider = ({
    min = 0,
    max = 100,
    step = 1,
    unit = "",
    value,
    onChange,
    color = "var(--3dverse-color-accent)",
    style,
    animateValueChange = false,
    trackStyle,
    filledTrackStyle,
    thumbStyle,
    valueStyle,
}: SliderProps) => {
    //--------------------------------------------------------------------------
    const sliderRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    //--------------------------------------------------------------------------
    const percentage = Math.min(Math.max(0, ((value - min) / (max - min)) * 100), 100);

    //--------------------------------------------------------------------------
    const updateValueFromPosition = (clientX: number) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const pos = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const percent = pos / rect.width;
        const rawValue = min + percent * (max - min);
        const stepped = Math.round(rawValue / step) * step;
        onChange(Number(stepped.toFixed(2)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        updateValueFromPosition(e.clientX);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setDragging(true);
        updateValueFromPosition(e.touches[0].clientX);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowLeft") onChange(Math.max(min, value - step));
        if (e.key === "ArrowRight") onChange(Math.min(max, value + step));
    };

    const stopDragging = () => setDragging(false);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent | TouchEvent) => {
            const x = (e as MouseEvent).clientX ?? (e as TouchEvent).touches[0].clientX;
            updateValueFromPosition(x);
        };
        const onUp = () => stopDragging();
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchmove", onMove);
        document.addEventListener("touchend", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.removeEventListener("touchmove", onMove);
            document.removeEventListener("touchend", onUp);
        };
    }, [dragging]);

    //--------------------------------------------------------------------------
    return (
        <div className={styles.sliderContainer}>
            <div
                ref={sliderRef}
                role="slider"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{ "--track-color": color, ...style, ...trackStyle } as React.CSSProperties}
                className={`${styles.track} ${animateValueChange ? styles.animateValueChange : ""}`}
            >
                <div className={styles.filled} style={{ width: `${percentage}%`, ...filledTrackStyle }} />
                <div
                    className={styles.thumb}
                    style={{ left: `${percentage}%`, backgroundColor: color, ...thumbStyle }}
                />
                <div className={styles.value} style={{ ...valueStyle }}>
                    {value} {unit}
                </div>
            </div>
        </div>
    );
};

import React from "react";

export default function Canvas({
    canvasRef,
    className = "rounded-md",
}: {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    className?: string;
}) {
    return (
        <canvas
            ref={canvasRef}
            onContextMenu={event => event.preventDefault()}
            style={{ width: "100%", height: "100%" }}
            tabIndex={1}
            className={`max-h-screen bg-color-overground rounded-xl ${className}`}
        ></canvas>
    );
}

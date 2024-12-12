//------------------------------------------------------------------------------
export default function Canvas({
    canvasRef,
    className = "",
    children,
}: React.PropsWithChildren<{
    canvasRef: React.RefObject<HTMLCanvasElement>;
    className?: string;
}>) {
    const canvas = (
        <canvas
            ref={canvasRef}
            onContextMenu={event => event.preventDefault()}
            style={{ width: "100%", height: "100%" }}
            tabIndex={1}
            className={`max-h-screen bg-[#1e222e] rounded-xl ${className}`}
        ></canvas>
    );

    if (!children) {
        return canvas;
    }

    return (
        <>
            {canvas}
            {children}
        </>
    );
}

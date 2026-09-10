import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type PropsWithChildren,
    type RefObject,
} from "react";

//------------------------------------------------------------------------------
type Orientation = "row" | "column";

const ResizableGroupContext = createContext<{
    orientation: Orientation;
    containerRef: RefObject<HTMLDivElement | null>;
} | null>(null);

function useResizableGroup() {
    const context = useContext(ResizableGroupContext);
    if (!context) {
        throw new Error("Resizable components must be used within a <ResizablePanelGroup>");
    }
    return context;
}

//------------------------------------------------------------------------------
/**
 * Flex container for resizable panels. The row/column switch stays owned by the caller's
 * className (eg. "flex-col xl:flex-row") so Tailwind's breakpoint classes keep working as
 * usual; this just watches the computed flex-direction so ResizableHandle drags along
 * whichever axis is actually in effect, without duplicating the breakpoint in JS.
 */
export function ResizablePanelGroup({ className, children }: PropsWithChildren<{ className?: string }>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [orientation, setOrientation] = useState<Orientation>("row");

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateOrientation = () => {
            setOrientation(getComputedStyle(element).flexDirection.startsWith("column") ? "column" : "row");
        };
        updateOrientation();

        const observer = new ResizeObserver(updateOrientation);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className={className}>
            <ResizableGroupContext.Provider value={{ orientation, containerRef }}>
                {children}
            </ResizableGroupContext.Provider>
        </div>
    );
}

//------------------------------------------------------------------------------
/**
 * A panel inside a ResizablePanelGroup. Pass `size` (percentage of the group's main axis) for
 * a panel controlled by an adjacent ResizableHandle; omit it to let the panel grow and fill the
 * remaining space instead. `collapsed` drops the forced size so the panel shrinks to fit its
 * content (used when the code block folds itself down to its small toggle button).
 */
export function ResizablePanel({
    size,
    collapsed = false,
    className,
    style,
    children,
}: PropsWithChildren<{ size?: number; collapsed?: boolean; className?: string; style?: CSSProperties }>) {
    const { orientation } = useResizableGroup();

    const sizeStyle: CSSProperties = collapsed
        ? { flex: "0 0 auto" }
        : size === undefined
          ? { flex: "1 1 auto" }
          : orientation === "row"
            ? { flex: "0 0 auto", width: `${size}%` }
            : { flex: "0 0 auto", height: `${size}%` };

    return (
        <div className={className} style={{ ...sizeStyle, minWidth: 0, minHeight: 0, ...style }}>
            {children}
        </div>
    );
}

//------------------------------------------------------------------------------
/**
 * Draggable divider between two panels. Reports movement along the group's current axis as a
 * percentage of the group's size, positive when dragged towards the end (right/down) — the
 * caller decides which panel(s) that grows or shrinks.
 */
export function ResizableHandle({
    onResize,
    className,
}: {
    onResize: (deltaPercent: number) => void;
    className?: string;
}) {
    const { orientation, containerRef } = useResizableGroup();
    const [dragging, setDragging] = useState(false);
    const lastPosRef = useRef(0);
    // Gates handlePointerMove via a ref rather than the `dragging` state above: pointer capture
    // (set synchronously in handlePointerDown) is what actually scopes pointermove to this drag,
    // and a fast synthetic first move can otherwise arrive before React flushes setDragging(true).
    const draggingRef = useRef(false);

    const getPos = (e: { clientX: number; clientY: number }) => (orientation === "row" ? e.clientX : e.clientY);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        lastPosRef.current = getPos(e);
        draggingRef.current = true;
        setDragging(true);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        const axisSize = orientation === "row" ? containerRef.current?.clientWidth : containerRef.current?.clientHeight;
        if (!axisSize) return;

        const pos = getPos(e);
        const deltaPercent = ((pos - lastPosRef.current) / axisSize) * 100;
        lastPosRef.current = pos;
        if (deltaPercent !== 0) onResize(deltaPercent);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        draggingRef.current = false;
        setDragging(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step = 2;
        if (orientation === "row" && e.key === "ArrowLeft") onResize(-step);
        else if (orientation === "row" && e.key === "ArrowRight") onResize(step);
        else if (orientation === "column" && e.key === "ArrowUp") onResize(-step);
        else if (orientation === "column" && e.key === "ArrowDown") onResize(step);
    };

    return (
        <div
            role="separator"
            aria-orientation={orientation === "row" ? "vertical" : "horizontal"}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown}
            className={`shrink-0 flex items-center justify-center select-none touch-none group ${
                orientation === "row" ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"
            } ${className ?? ""}`}
        >
            <div
                className={`rounded-full bg-tertiary/25 transition-colors group-hover:bg-tertiary/50 ${dragging ? "bg-tertiary!" : ""} ${
                    orientation === "row" ? "w-px h-full" : "w-full h-px"
                }`}
            />
        </div>
    );
}

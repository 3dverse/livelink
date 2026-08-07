//------------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

//------------------------------------------------------------------------------
import { ConsolePanel } from "../../../../components/common/ConsolePanel";

//------------------------------------------------------------------------------
const LINE_HEIGHT_PX = 15;

/**
 * A blob of text, verbatim, with line numbers — a recording being replayed, the simulator config a
 * sample tells you to run, the commands to start it.
 *
 * Pass `activeLine` to follow a stream through it: the text is rendered once and never re-rendered,
 * only the highlight bar moves, so following costs nothing whatever the rate. Omit it and the panel
 * is a plain listing, without the follow toggle that would have nothing to follow.
 */
export function SourceTextPanel({
    title,
    note,
    text,
    activeLine = null,
    defaultCollapsed = false,
}: {
    title: string;
    note?: string;
    text: string;
    /** 1-based line to highlight, or null for none. */
    activeLine?: number | null;
    defaultCollapsed?: boolean;
}) {
    const scroller = useRef<HTMLDivElement | null>(null);
    const [isFollowing, setIsFollowing] = useState(true);

    // Read by the callback ref below, which fires outside of the effect's dependency graph.
    const currentLine = useRef(activeLine);
    currentLine.current = activeLine;

    const lineCount = useMemo(() => text.split("\n").length, [text]);
    const lineNumbers = useMemo(
        () => Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"),
        [lineCount],
    );

    const scrollToActiveLine = useCallback(() => {
        const element = scroller.current;
        const line = currentLine.current;
        if (!element || !isFollowing || line === null) {
            return;
        }
        element.scrollTop = line * LINE_HEIGHT_PX - element.clientHeight / 2;
    }, [isFollowing]);

    // The body is unmounted while the panel is folded, so the scroller has to be caught up the
    // moment it is attached again — a mount-time effect here would not run, the mount being the
    // child's and not this component's.
    const attachScroller = useCallback(
        (element: HTMLDivElement | null) => {
            scroller.current = element;
            scrollToActiveLine();
        },
        [scrollToActiveLine],
    );

    useEffect(scrollToActiveLine, [activeLine, scrollToActiveLine]);

    return (
        <ConsolePanel
            title={title}
            note={note}
            defaultCollapsed={defaultCollapsed}
            control={
                activeLine !== null ? (
                    <button
                        className="cursor-pointer text-[#637777] hover:text-[#7fdbca]"
                        onClick={() => setIsFollowing(previous => !previous)}
                    >
                        {isFollowing ? "following" : "free scroll"}
                    </button>
                ) : undefined
            }
        >
            <div
                ref={attachScroller}
                className="flex-1 min-h-0 max-h-[10vh] overflow-auto text-[10px] leading-3.75 font-mono"
            >
                <div
                    className="relative flex"
                    style={{ height: lineCount * LINE_HEIGHT_PX }}
                >
                    {activeLine !== null && (
                        <div
                            className="absolute inset-x-0 bg-[#addb67]/15 border-l-2 border-[#addb67]"
                            style={{
                                top: activeLine * LINE_HEIGHT_PX,
                                height: LINE_HEIGHT_PX,
                            }}
                        />
                    )}
                    <pre className="px-2 text-right text-[#637777] select-none m-0!">
                        {lineNumbers}
                    </pre>
                    <pre className="pr-3 text-[#addb67] m-0!">{text}</pre>
                </div>
            </div>
        </ConsolePanel>
    );
}

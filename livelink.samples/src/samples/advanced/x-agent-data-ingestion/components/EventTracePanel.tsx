//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import type { IngestEvent } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
import { ConsolePanel } from "../../../../components/common/ConsolePanel";

//------------------------------------------------------------------------------
/**
 * The wall-clock part of a timestamp, as the trace panels print it.
 */
function formatTime(date: Date | undefined): string {
    if (!date) {
        return "--:--:--";
    }
    return date.toISOString().slice(11, 23);
}

//------------------------------------------------------------------------------
/**
 * One line of the trace.
 */
export type TraceRow = {
    seq: number;
    time: string;
    channel: string;
    detail: string;
};

//------------------------------------------------------------------------------
const DEFAULT_CAPACITY = 120;
const FLUSH_INTERVAL_MS = 100;

/**
 * Collect events for display without re-rendering per event.
 *
 * An ingestion stream runs at hundreds of events a second; React state does not. Events are pushed
 * into a ref and published on a timer, so the cost of watching a stream is fixed whatever its rate.
 *
 * `onEvent` is what to hand to an observing sink; `count` is the total seen, published
 * on the same tick as `rows` so anything derived from both stays consistent.
 */
export function useEventTrace({
    capacity = DEFAULT_CAPACITY,
    describe,
}: {
    capacity?: number;
    /** How to summarize a payload in one short string. */
    describe: (payload: unknown) => string;
}): {
    rows: Array<TraceRow>;
    count: number;
    onEvent: (event: IngestEvent) => void;
    reset: () => void;
} {
    const [rows, setRows] = useState<Array<TraceRow>>([]);
    const [count, setCount] = useState(0);

    const pending = useRef<Array<TraceRow>>([]);
    const seq = useRef(0);
    const flushed = useRef(0);

    // Held in a ref so a caller passing an inline arrow does not restart the flush timer.
    const describeRef = useRef(describe);
    describeRef.current = describe;

    const onEvent = useCallback(
        (event: IngestEvent) => {
            pending.current.push({
                seq: seq.current++,
                time: formatTime(event.source_timestamp ?? event.received_at),
                channel: event.channel,
                detail: describeRef.current(event.payload),
            });
            if (pending.current.length > capacity) {
                pending.current = pending.current.slice(-capacity);
            }
        },
        [capacity],
    );

    const reset = useCallback(() => {
        pending.current = [];
        seq.current = 0;
        flushed.current = 0;
        setRows([]);
        setCount(0);
    }, []);

    useEffect(() => {
        const flush = setInterval(() => {
            if (seq.current === flushed.current) {
                return;
            }
            flushed.current = seq.current;
            setRows(pending.current.slice());
            setCount(seq.current);
        }, FLUSH_INTERVAL_MS);
        return () => clearInterval(flush);
    }, []);

    return { rows, count, onEvent, reset };
}

//------------------------------------------------------------------------------
/**
 * The events going into the pipeline, as they go in.
 */
export function EventTracePanel({
    rows,
    title = "ingested events",
}: {
    rows: Array<TraceRow>;
    title?: string;
}) {
    const scroller = useRef<HTMLDivElement | null>(null);

    const scrollToEnd = useCallback(() => {
        const element = scroller.current;
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }, []);

    // Also runs when the panel is unfolded and the body is mounted afresh. See `SourceTextPanel`.
    const attachScroller = useCallback(
        (element: HTMLDivElement | null) => {
            scroller.current = element;
            scrollToEnd();
        },
        [scrollToEnd],
    );

    useEffect(scrollToEnd, [rows, scrollToEnd]);

    return (
        <ConsolePanel
            title={title}
            note={rows.length > 0 ? `last ${rows.length}` : undefined}
        >
            <div
                ref={attachScroller}
                className="flex-1 min-h-0 max-h-[10vh] overflow-auto px-2 py-1 text-[10px] leading-3.75 font-mono"
            >
                {rows.length === 0 ? (
                    <p className="text-[#637777]">
                        Waiting for the first event…
                    </p>
                ) : (
                    rows.map(row => (
                        <div
                            key={row.seq}
                            className="flex gap-2 whitespace-nowrap tabular-nums"
                        >
                            <span className="text-[#637777]">{row.time}</span>
                            <span className="text-[#c792ea]">
                                {row.channel}
                            </span>
                            <span className="text-[#addb67]">{row.detail}</span>
                        </div>
                    ))
                )}
            </div>
        </ConsolePanel>
    );
}

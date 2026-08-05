//------------------------------------------------------------------------------
import { useState, type ReactNode } from "react";

//------------------------------------------------------------------------------
/**
 * A collapsible console panel: a title that folds the body away, an optional control on the right,
 * and a body that scrolls within its own height cap.
 */
export function ConsolePanel({
    title,
    note,
    control,
    defaultCollapsed = false,
    children,
}: {
    title: string;
    note?: string;
    /** Rendered at the right of the header, and only while the panel is open. */
    control?: ReactNode;
    defaultCollapsed?: boolean;
    /**
     * The body is unmounted while folded, so a body that scrolls itself has to catch up on
     * reopening — attach the scroller with a callback ref rather than a mount-time effect.
     */
    children: ReactNode;
}) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    return (
        <section className="flex flex-col min-h-0 max-h-[35vh] bg-[black]/90 rounded-sm shadow-lg overflow-hidden">
            <header className="flex items-center gap-2 px-2 py-1 text-[11px] text-[#7fdbca] border-b border-[#333]">
                <button
                    className="flex items-center gap-1 grow text-left cursor-pointer hover:text-white"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    aria-expanded={!isCollapsed}
                >
                    <span className="text-[#637777]">{isCollapsed ? "▸" : "▾"}</span>
                    {title}
                    {note && <span className="text-[#637777]">— {note}</span>}
                </button>
                {!isCollapsed && control}
            </header>

            {!isCollapsed && children}
        </section>
    );
}

//------------------------------------------------------------------------------
/**
 * A single labelled number, as the console panels display them.
 */
export function Counter({ label, value, dimmed = false }: { label: string; value: number; dimmed?: boolean }) {
    return (
        <span className={dimmed ? "text-[#637777]" : undefined}>
            {label} <b>{value}</b>
        </span>
    );
}

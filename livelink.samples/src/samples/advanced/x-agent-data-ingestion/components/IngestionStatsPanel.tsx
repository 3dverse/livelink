//------------------------------------------------------------------------------
import type { IngestionStats } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
import {
    ConsolePanel,
    Counter,
} from "../../../../components/common/ConsolePanel";

//------------------------------------------------------------------------------
/**
 * What the pipeline actually did with the events — the answer the transport and the scene cannot
 * give on their own. Drops are dimmed and listed by reason: `unresolved_entity` climbing while
 * `events_matched` does is the normal signature of a stream arriving before its entities exist.
 *
 * Two columns rather than a wrapping row, so the counters stay readable in a narrow panel.
 */
export function IngestionStatsPanel({
    stats,
}: {
    stats: IngestionStats | null;
}) {
    return (
        <ConsolePanel title="pipeline" note={stats ? undefined : "idle"}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-2 py-1 text-[11px] text-[#addb67] tabular-nums">
                {stats === null ? (
                    <p className="text-[#637777]">Not ingesting.</p>
                ) : (
                    <>
                        <Counter
                            label="received"
                            value={stats.events_received}
                        />
                        <Counter label="matched" value={stats.events_matched} />
                        <Counter
                            label="applied"
                            value={stats.updates_applied}
                        />
                        <Counter
                            label="written"
                            value={stats.components_written}
                        />
                        <Counter
                            label="deduped"
                            value={stats.components_deduped}
                        />
                        {Object.entries(stats.drops).map(([reason, count]) => (
                            <Counter
                                key={reason}
                                label={reason}
                                value={count}
                                dimmed={true}
                            />
                        ))}
                    </>
                )}
            </div>
        </ConsolePanel>
    );
}

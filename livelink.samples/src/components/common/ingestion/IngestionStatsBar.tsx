//------------------------------------------------------------------------------
import type { IngestionStats } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
import { Counter } from "../ConsolePanel";

//------------------------------------------------------------------------------
/**
 * What the pipeline actually did with the events — the answer the transport and the scene cannot
 * give on their own. Drops are dimmed and listed by reason: `unresolved_entity` climbing while
 * `events_matched` does is the normal signature of a stream arriving before its entities exist.
 */
export function IngestionStatsBar({ stats }: { stats: IngestionStats | null }) {
    if (!stats) {
        return null;
    }

    return (
        <div className="px-3 py-2 bg-[black] text-[#addb67] text-xs tabular-nums rounded-sm shadow-lg flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Counter label="received" value={stats.events_received} />
            <Counter label="matched" value={stats.events_matched} />
            <Counter label="applied" value={stats.updates_applied} />
            <Counter label="written" value={stats.components_written} />
            <Counter label="deduped" value={stats.components_deduped} />
            {Object.entries(stats.drops).map(([reason, count]) => (
                <Counter key={reason} label={reason} value={count} dimmed={true} />
            ))}
        </div>
    );
}

/**
 * Why an event (or one of the entity updates it produced) did not reach an entity.
 *
 * `no_binding` and `no_mapping_matched` are the two that matter during bring-up: they are the
 * difference between "the stream is not arriving", "it arrives but nothing is listening yet" and
 * "it arrives but no mapping wants it" — three failures that otherwise look identical from outside.
 *
 * @category Data
 */
export type IngestionDropReason =
    /** No scene was bound yet (no session ready), so the event had nowhere to go. */
    | "no_binding"
    /** No mapping's `channel` / `when` selectors matched the event. */
    | "no_mapping_matched"
    /** The payload did not match the mapping's JSON Schema. */
    | "schema"
    /** The mapping produced an update carrying no usable `id`. */
    | "no_id"
    /** The mapping's `updates` returned null (or nothing) — a deliberate ignore. */
    | "no_updates"
    /** The id resolved to no entity in the scene. */
    | "unresolved_entity";

/**
 * The ingestion counters of one {@link EventMapping}.
 *
 * @category Data
 */
export type MappingStats = {
    /** Index of the mapping in the pipeline's mapping list. */
    index: number;
    /** The mapping's channel pattern, when it declares one. */
    channel?: string;
    /** Events whose selectors matched this mapping. */
    events_matched: number;
    /** (entity update, scene) pairs this mapping successfully applied. */
    updates_applied: number;
    /** Events this mapping matched but did not apply, by reason. */
    drops: Partial<Record<IngestionDropReason, number>>;
    /** When this mapping last matched an event. */
    last_event_at: Date | null;
};

/**
 * A snapshot of what an {@link IngestionPipeline} has actually done — the answer to "is data
 * flowing?", which the transports and the scene cannot give on their own.
 *
 * Note that {@link events_matched} and {@link events_dropped} **overlap**: an event a mapping
 * selected but then applied nothing for (no id, no updates, unresolved entity) counts in both, so
 * their sum can exceed {@link events_received}.
 *
 * @category Data
 */
export type IngestionStats = {
    /** Events submitted to the pipeline, whatever became of them. */
    events_received: number;
    /** Events at least one mapping matched. Overlaps {@link events_dropped}. */
    events_matched: number;
    /** Events no mapping applied at all, for any reason. Overlaps {@link events_matched}. */
    events_dropped: number;
    /** (entity update, scene) pairs successfully applied. */
    updates_applied: number;
    /** Component writes actually sent to the scene. */
    components_written: number;
    /** Component writes skipped because the value was unchanged. */
    components_deduped: number;
    /** Whole-entity directives (`delete` / `hide` / `show`) carried out. */
    directives_applied: number;
    /** Drop totals across every mapping. */
    drops: Partial<Record<IngestionDropReason, number>>;
    /** When the pipeline last received an event, whatever became of it. */
    last_event_at: Date | null;
    /** When the pipeline last wrote to a scene. */
    last_applied_at: Date | null;
    /** Scenes currently bound. */
    bound_scene_count: number;
    /** Per-mapping breakdown, index-aligned with the pipeline's mappings. */
    per_mapping: Array<MappingStats>;
};

/**
 * What an {@link IngestionPipeline} reports its work to. Two implementations: {@link StatsCollector},
 * which counts, and {@link NoopStatsCollector}, which does nothing — chosen by the pipeline's
 * `stats` option.
 *
 * Timestamps travel as epoch milliseconds so the counting path allocates nothing; `Date`s are
 * materialized in {@link snapshot} only.
 *
 * @internal
 */
export interface IngestionStatsCollector {
    eventReceived(at_ms: number): void;
    eventMatched(): void;
    eventDropped(): void;
    mappingMatched(index: number, at_ms: number): void;
    dropped(reason: IngestionDropReason, mapping_index?: number): void;
    applied(params: { mapping_index: number; written: number; deduped: number; directive: boolean }): void;
    snapshot(params: { bound_scene_count: number }): IngestionStats;
}

/**
 * Mutable counters behind {@link IngestionStats}. Kept internal: consumers read immutable snapshots
 * through `pipeline.stats`.
 *
 * @internal
 */
export class StatsCollector implements IngestionStatsCollector {
    #events_received = 0;
    #events_matched = 0;
    #events_dropped = 0;
    #updates_applied = 0;
    #components_written = 0;
    #components_deduped = 0;
    #directives_applied = 0;
    #last_event_at_ms: number | null = null;
    #last_applied_at_ms: number | null = null;
    readonly #drops = new Map<IngestionDropReason, number>();
    readonly #per_mapping: Array<{
        index: number;
        channel?: string;
        events_matched: number;
        updates_applied: number;
        drops: Map<IngestionDropReason, number>;
        last_event_at_ms: number | null;
    }>;

    constructor({ channels }: { channels: Array<string | undefined> }) {
        this.#per_mapping = channels.map((channel, index) => ({
            index,
            ...(channel !== undefined ? { channel } : {}),
            events_matched: 0,
            updates_applied: 0,
            drops: new Map<IngestionDropReason, number>(),
            last_event_at_ms: null,
        }));
    }

    eventReceived(at_ms: number): void {
        this.#events_received++;
        this.#last_event_at_ms = at_ms;
    }

    eventMatched(): void {
        this.#events_matched++;
    }

    eventDropped(): void {
        this.#events_dropped++;
    }

    mappingMatched(index: number, at_ms: number): void {
        const mapping = this.#per_mapping[index];
        mapping.events_matched++;
        mapping.last_event_at_ms = at_ms;
    }

    dropped(reason: IngestionDropReason, mapping_index?: number): void {
        this.#drops.set(reason, (this.#drops.get(reason) ?? 0) + 1);
        if (mapping_index !== undefined) {
            const drops = this.#per_mapping[mapping_index].drops;
            drops.set(reason, (drops.get(reason) ?? 0) + 1);
        }
    }

    applied({
        mapping_index,
        written,
        deduped,
        directive,
    }: {
        mapping_index: number;
        written: number;
        deduped: number;
        directive: boolean;
    }): void {
        this.#updates_applied++;
        this.#components_written += written;
        this.#components_deduped += deduped;
        if (directive) {
            this.#directives_applied++;
        }
        this.#last_applied_at_ms = Date.now();
        this.#per_mapping[mapping_index].updates_applied++;
    }

    snapshot({ bound_scene_count }: { bound_scene_count: number }): IngestionStats {
        return {
            events_received: this.#events_received,
            events_matched: this.#events_matched,
            events_dropped: this.#events_dropped,
            updates_applied: this.#updates_applied,
            components_written: this.#components_written,
            components_deduped: this.#components_deduped,
            directives_applied: this.#directives_applied,
            drops: Object.fromEntries(this.#drops),
            last_event_at: toDate(this.#last_event_at_ms),
            last_applied_at: toDate(this.#last_applied_at_ms),
            bound_scene_count,
            per_mapping: this.#per_mapping.map(mapping => ({
                index: mapping.index,
                ...(mapping.channel !== undefined ? { channel: mapping.channel } : {}),
                events_matched: mapping.events_matched,
                updates_applied: mapping.updates_applied,
                drops: Object.fromEntries(mapping.drops),
                last_event_at: toDate(mapping.last_event_at_ms),
            })),
        };
    }
}

/**
 * The collector used when a pipeline is built with `stats: false`: every call is a no-op, so the
 * applied path costs nothing at all. Its {@link snapshot} is never called — a pipeline with stats
 * off reports `null` rather than a snapshot of zeros, which would read as "nothing flowed".
 *
 * @internal
 */
export class NoopStatsCollector implements IngestionStatsCollector {
    eventReceived(): void {}
    eventMatched(): void {}
    eventDropped(): void {}
    mappingMatched(): void {}
    dropped(): void {}
    applied(): void {}
    snapshot(): IngestionStats {
        throw new Error("Stats are disabled on this pipeline (`stats: false`).");
    }
}

/**
 * An epoch-millisecond timestamp as a `Date`, for a snapshot.
 */
function toDate(at_ms: number | null): Date | null {
    return at_ms === null ? null : new Date(at_ms);
}

//------------------------------------------------------------------------------
import type { Entity } from "@livelink.base/scene/Entity";
import type { Scene } from "@livelink.base/scene/Scene";

//------------------------------------------------------------------------------
import type { IngestEvent } from "./IngestEvent";
import type {
    AnyContinuousUpdate,
    ComponentUpdates,
    EntityDirective,
    EntityUpdate,
    EventMapping,
    SceneEntities,
} from "./EventMapping";
import { isContinuousUpdate } from "./EventMapping";
import type { EntityResolver } from "./resolvers/EntityResolver";
import { ExistingEntityResolver } from "./resolvers/ExistingEntityResolver";
import { SpawningEntityResolver } from "./resolvers/SpawningEntityResolver";
import { ComponentPatchApplier } from "./apply/ComponentPatchApplier";
import { SchemaValidator } from "./SchemaValidator";
import {
    NoopStatsCollector,
    StatsCollector,
    type IngestionStats,
    type IngestionStatsCollector,
} from "./IngestionStats";
import { matchChannel } from "./util/channel";
import { WarnOnceReporter } from "./util/reporting";

/**
 * A scene attached to an {@link IngestionPipeline}. Hold it to detach that scene again; the
 * pipeline keeps ingesting into whatever is still bound.
 *
 * @category Data
 */
export type PipelineBinding = {
    /** The bound scene. */
    readonly scene: Scene;

    /** Detach the scene and release the per-scene resolvers (and their scene listeners). */
    unbind(): void;
};

/**
 * Options for an {@link IngestionPipeline}.
 *
 * @category Data
 */
export type IngestionPipelineOptions = {
    /**
     * The mapping(s) describing how events drive entities. An event is handled by every mapping
     * whose `channel` / `when` selectors match it.
     */
    mappings: EventMapping | Array<EventMapping>;

    /**
     * Validate **every** event against the schema of the mappings that declare one (requires the
     * optional `ajv` dependency). Off by default: only the first matching event of each such
     * mapping is validated; full per-event validation is a debugging tool.
     */
    validate?: boolean;

    /**
     * Count what the pipeline does, readable through {@link IngestionPipeline.stats}. On by default:
     * the counting path allocates nothing and costs a handful of integer increments, well under what
     * a single component write already costs, and the `no_binding` / `no_mapping_matched` /
     * `unresolved_entity` breakdown is the only thing that tells "the stream is not arriving" apart
     * from "nothing is listening yet" and "no mapping wants it".
     *
     * Set it to `false` for the very highest-frequency streams; `stats` then reports `null`.
     */
    stats?: boolean;

    /**
     * Called when a mapping's `updates` function throws or returns something unusable, or when an
     * entity write fails. Ingestion continues — one bad event does not stop the stream.
     */
    onError?: (error: Error) => void;

    /**
     * On by default: the first time the pipeline resolves or spawns an entity for an id, it sets
     * `entity.auto_broadcast = false` — the entity is being driven by this stream, so it should not
     * re-broadcast those writes to other clients. Set to `false` to leave `auto_broadcast` untouched
     * and manage it yourself, e.g. through a `spawn` template's `options.auto_broadcast`, or directly
     * on entities found by `byName` / `byUuid` / `resolve`.
     */
    manage_auto_broadcast?: boolean;
};

/**
 * A continuous update currently driving one id, with what it needs to be re-sampled.
 */
type InstalledContinuation = {
    update: AnyContinuousUpdate;
    /**
     * Seconds this continuation has been advanced, accumulated from the ticks themselves rather
     * than read off the wall clock — so `tick` is the only thing that moves a motion forward, and
     * replaying the same ticks replays the same motion.
     */
    since_seconds: number;
    /**
     * The event to resolve this id against: a tick has none of its own, and resolution takes one.
     * Deliberately **stale** — it is the message that said which entity this motion is about.
     */
    event: IngestEvent;
};

/**
 * One mapping, its schema-validation state, the continuations it currently drives and the per-entity
 * state those hand back to it — all held once for the pipeline's lifetime.
 *
 * Continuations sit here, per mapping and keyed by id, rather than on a {@link BindingState} slot:
 * `updates` runs once per event and fans out to every bound scene, so a continuation must be sampled
 * once per tick and fan out the same way. Per binding, a stateful closure would advance once per
 * session — two sessions, and a shaft turns at double speed.
 *
 * `states` is keyed the same way and deliberately **outlives** the continuations reading it: a new
 * rate installs a new continuation, and the shaft must carry on from the angle it had reached.
 */
type CompiledMapping = {
    config: EventMapping;
    validator_promise: Promise<SchemaValidator> | null;
    validated_first: boolean;
    continuations: Map<string, InstalledContinuation>;
    states: Map<string, object>;
};

/**
 * One entity update on its way to the bound scenes, with the event that produced it — the event
 * itself for an ingested update, the installing event for one a continuation produced.
 */
type PendingUpdate = {
    entry: EntityUpdate;
    event: IngestEvent;
};

/**
 * The per-scene resolve+apply state of one mapping (index-aligned with the compiled mappings).
 */
type BindingState = {
    scene: Scene;
    slots: Array<{ resolver: EntityResolver; applier: ComponentPatchApplier }>;
};

/**
 * Turns ingested events into entity updates, in every scene bound to it, according to one or more
 * {@link EventMapping}s.
 *
 * This is the whole data layer, with **no** dependency on an {@link Agent}, a {@link Transport} or a
 * session: you bind scenes to it and push events in. That makes {@link IngestionPipeline.ingest} the
 * primary verb of the SDK's data module — a mapping can be exercised from a test, a webhook, a REST
 * handler or a replay tool without a broker anywhere in sight:
 *
 * ```typescript
 * const pipeline = new IngestionPipeline({ mappings });
 * pipeline.bind({ scene });
 * await pipeline.ingest({ channel: "uagv/v2/m/AGV-1/visualization", payload });
 * ```
 *
 * For each event: pick the matching mappings; per mapping, (opt.) validate the payload against its
 * schema, call its `updates` function to get one entity update or several — then, in each bound
 * scene, resolve every id to an entity (found or spawned per the mapping's `entities`) and apply its
 * update, skipping redundant component writes.
 *
 * To drive the scenes an {@link Agent} is attached to, and to feed the pipeline from a transport,
 * use {@link SceneIngestion} — it owns a pipeline and binds/unbinds sessions for you.
 *
 * @category Data
 */
export class IngestionPipeline {
    /**
     * The mappings, compiled once at construction.
     */
    readonly #mappings: Array<CompiledMapping>;

    /**
     * Whether to validate every event against its schema (requires the optional `ajv` dependency).
     */
    readonly #validate_all: boolean;

    /**
     * Called when a mapping's own code throws or an entity write fails.
     */
    readonly #on_error: (error: Error) => void;

    /**
     * Whether the pipeline forces `auto_broadcast = false` on entities it resolves or spawns.
     */
    readonly #manage_auto_broadcast: boolean;

    /**
     * Warns once per unique message, to avoid log spam when many events fail the same way.
     */
    readonly #reporter = new WarnOnceReporter();

    /**
     * The bound scenes and their per-mapping resolve+apply state.
     */
    readonly #bindings = new Map<PipelineBinding, BindingState>();

    /**
     * What the pipeline has actually done, exposed as immutable snapshots through {@link stats}.
     * A {@link NoopStatsCollector} when the `stats` option is off.
     */
    readonly #stats: IngestionStatsCollector;

    /**
     * Whether {@link #stats} counts anything, so {@link stats} can report `null` instead of zeros.
     */
    readonly #stats_enabled: boolean;

    /**
     * @throws If no mapping is given, or a mapping is malformed — its `entities` declaring none of
     * the four strategies, or its `updates` not being a function. Both are unreachable from
     * TypeScript; they are what a JavaScript consumer gets instead of a compile error.
     */
    constructor({ mappings, validate, stats, onError, manage_auto_broadcast }: IngestionPipelineOptions) {
        this.#validate_all = validate ?? false;
        this.#on_error = onError ?? ((error): void => console.error("[ingestion-pipeline]", error));
        this.#manage_auto_broadcast = manage_auto_broadcast ?? true;

        const list = Array.isArray(mappings) ? mappings : [mappings];
        if (list.length === 0) {
            throw new Error("IngestionPipeline requires at least one mapping.");
        }
        this.#mappings = list.map((config, index) => {
            validateMapping(config, index);
            return {
                config,
                validator_promise: null,
                validated_first: false,
                continuations: new Map(),
                states: new Map(),
            };
        });

        this.#stats_enabled = stats ?? true;
        this.#stats = this.#stats_enabled
            ? new StatsCollector({ channels: list.map(mapping => mapping.channel) })
            : new NoopStatsCollector();
    }

    /**
     * What the pipeline has done so far — events in, updates out, and why anything was dropped.
     * `null` when the pipeline was built with `stats: false`.
     */
    get stats(): IngestionStats | null {
        if (!this.#stats_enabled) {
            return null;
        }
        return this.#stats.snapshot({
            bound_scene_count: this.#bindings.size,
            continuations_active: this.#continuationCounts(),
        });
    }

    /**
     * How many {@link ContinuousUpdate}s are installed across every mapping — the answer to "the
     * stream is fine, so why is nothing moving?".
     *
     * Also readable as `stats.continuations_active`; this getter works with `stats: false` too, and
     * is what {@link SceneIngestion} checks to know whether its clock has anything to advance.
     */
    get continuationCount(): number {
        let count = 0;
        for (const mapping of this.#mappings) {
            count += mapping.continuations.size;
        }
        return count;
    }

    /**
     * How many continuations each mapping drives, index-aligned with the mappings — what
     * {@link MappingStats.continuations_active} reports.
     */
    #continuationCounts(): Array<number> {
        return this.#mappings.map(mapping => mapping.continuations.size);
    }

    /**
     * The number of scenes currently bound.
     */
    get boundSceneCount(): number {
        return this.#bindings.size;
    }

    /**
     * Attach a scene: ingested events start driving its entities. Each scene gets its own resolvers,
     * because a resolution (and its cache) is only meaningful against one scene.
     *
     * Binding the same scene twice returns two independent bindings; unbind the one you no longer
     * want.
     */
    bind({ scene }: { scene: Scene }): PipelineBinding {
        const binding: PipelineBinding = {
            scene,
            unbind: (): void => {
                const state = this.#bindings.get(binding);
                if (!state) {
                    return;
                }
                this.#bindings.delete(binding);
                for (const { resolver } of state.slots) {
                    resolver.dispose?.();
                }
            },
        };

        this.#bindings.set(binding, {
            scene,
            slots: this.#mappings.map(mapping => ({
                resolver: createResolver(mapping.config.entities, scene, this.#manage_auto_broadcast),
                applier: new ComponentPatchApplier(),
            })),
        });

        return binding;
    }

    /**
     * Stop the {@link ContinuousUpdate}s currently installed — one id's, or every one of them. The
     * entities keep their last value, and a later event carrying the same id installs a fresh motion.
     *
     * The answer to "the broker died, why is the scene still moving?". Nothing expires a motion on
     * its own, because "no event replaced it" is not the same fact as "the stream is dead" — one
     * topic may carry payloads of several shapes. {@link SceneIngestion} calls this when it stops
     * its sources.
     *
     * The per-entity state is **not** dropped, so a motion started again picks up where this one
     * stopped rather than snapping back.
     */
    clearContinuations({ id }: { id?: string } = {}): void {
        for (const mapping of this.#mappings) {
            if (id === undefined) {
                mapping.continuations.clear();
            } else {
                mapping.continuations.delete(id);
            }
        }
    }

    /**
     * Detach every bound scene.
     */
    unbindAll(): void {
        for (const binding of Array.from(this.#bindings.keys())) {
            binding.unbind();
        }
    }

    /**
     * Push one event through the pipeline: every mapping whose selectors match it drives the
     * entities it addresses, in every bound scene.
     *
     * Never throws — a mapping that throws is reported to `onError` and the stream continues.
     */
    async ingest(event: IngestEvent): Promise<void> {
        const received_at_ms = event.received_at?.getTime() ?? Date.now();
        this.#stats.eventReceived(received_at_ms);

        if (this.#bindings.size === 0) {
            this.#stats.dropped("no_binding");
            this.#stats.eventDropped();
            return;
        }

        let matched = false;
        let applied = false;
        for (let index = 0; index < this.#mappings.length; index++) {
            const mapping = this.#mappings[index];
            if (!this.#matches(mapping.config, event)) {
                continue;
            }
            matched = true;
            this.#stats.mappingMatched(index, received_at_ms);
            applied = (await this.#processWithMapping(mapping, index, event)) || applied;
        }

        if (!matched) {
            this.#stats.dropped("no_mapping_matched");
        } else {
            this.#stats.eventMatched();
        }
        if (!applied) {
            this.#stats.eventDropped();
        }
    }

    /**
     * Advance every {@link ContinuousUpdate} currently installed, and write what they produce.
     *
     * This is what keeps a machine moving between two messages: an event that reported a *rate*
     * installed a continuation, and each tick asks it where the entity is now. It owns **no timer** —
     * the caller decides the cadence, which is what makes a moving scene reproducible from a test:
     *
     * ```typescript
     * await pipeline.ingest(event);   // "turning at 90 rpm"
     * await pipeline.tick(0.5);       // half a second later, wherever that puts it
     * ```
     *
     * {@link SceneIngestion} calls this on its own interval, so a consumer using it has nothing to
     * do. A tick is deliberately **not** an event: it leaves `events_received` and `last_event_at`
     * alone, so those keep answering "is data still arriving?" while the scene moves.
     *
     * Never throws — a continuation that throws is reported to `onError` and dropped.
     */
    async tick(elapsed_seconds: number): Promise<void> {
        this.#stats.tickProcessed();
        if (this.#bindings.size === 0) {
            return;
        }

        for (let index = 0; index < this.#mappings.length; index++) {
            const mapping = this.#mappings[index];
            if (mapping.continuations.size === 0) {
                continue;
            }
            const pending = this.#sampleContinuations(mapping, elapsed_seconds);
            if (pending.length === 0) {
                continue;
            }
            await Promise.all(
                Array.from(this.#bindings, ([binding, state]) =>
                    this.#applyToBinding(binding, state, index, pending, { from_tick: true }),
                ),
            );
        }
    }

    /**
     * Sample one mapping's continuations once, dropping those that report they are done.
     *
     * Sampling happens here, once, rather than inside {@link #applyToBinding}: a continuation is
     * usually stateful, and running it once per bound scene would advance it once per session.
     */
    #sampleContinuations(mapping: CompiledMapping, elapsed_seconds: number): Array<PendingUpdate> {
        const pending: Array<PendingUpdate> = [];

        for (const [id, installed] of mapping.continuations) {
            installed.since_seconds += elapsed_seconds;

            const sampled = this.#sample(mapping, id, installed.update, {
                delta_seconds: elapsed_seconds,
                since_seconds: installed.since_seconds,
            });
            if (sampled === null) {
                mapping.continuations.delete(id);
                continue;
            }
            pending.push({ entry: { id, update: sampled }, event: installed.event });
        }

        return pending;
    }

    /**
     * Ask one continuous update where its entity is now, against the state the pipeline holds for
     * that id.
     *
     * @returns What to write, or null when the motion is over (or reported a failure) — in both cases
     * the caller uninstalls it.
     */
    #sample(
        mapping: CompiledMapping,
        id: string,
        update: AnyContinuousUpdate,
        time: { delta_seconds: number; since_seconds: number },
    ): ComponentUpdates | EntityDirective | null {
        // `initial_state` applies only to an id that has no state yet, so a later event carrying a
        // fresh rate cannot reset a motion already under way. Copied rather than shared, so one
        // `initial_state` object declared once in a mapping cannot end up driving every entity.
        const held = mapping.states.get(id);
        const state: object = held ?? { ...(update.initial_state ?? {}) };
        if (held === undefined) {
            mapping.states.set(id, state);
        }

        try {
            return update.sample({ ...time, state }) ?? null;
        } catch (error) {
            // A throwing continuation would throw again on every tick: drop it rather than report the
            // same failure thirty times a second.
            this.#on_error(error as Error);
            return null;
        }
    }

    /**
     * Whether an event is covered by a mapping's `channel`/`when` selectors.
     */
    #matches(config: EventMapping, event: IngestEvent): boolean {
        if (config.channel !== undefined && !matchChannel(config.channel, event.channel)) {
            return false;
        }
        return config.when === undefined || config.when(event);
    }

    /**
     * One mapping's pipeline: validate → work out the updates → resolve+apply in each bound scene.
     *
     * @returns Whether anything reached a scene.
     */
    async #processWithMapping(mapping: CompiledMapping, index: number, event: IngestEvent): Promise<boolean> {
        if (!(await this.#validatePayload(mapping, event))) {
            this.#stats.dropped("schema", index);
            return false;
        }

        const updates = this.#resolveUpdates(mapping, index, event);
        if (!updates) {
            return false;
        }

        const results = await Promise.all(
            Array.from(this.#bindings, ([binding, state]) =>
                this.#applyToBinding(
                    binding,
                    state,
                    index,
                    updates.map(entry => ({ entry, event })),
                    { from_tick: false },
                ),
            ),
        );
        return results.some(Boolean);
    }

    /**
     * The entity updates one event produces through one mapping, normalized to an array: `updates`
     * may return a single {@link EntityUpdate}, an array of them, or null.
     *
     * Entries carrying no usable id are dropped here rather than in {@link #applyToBinding}, which
     * runs once per bound scene and would count each one twice over.
     */
    #resolveUpdates(mapping: CompiledMapping, index: number, event: IngestEvent): Array<EntityUpdate> | null {
        let produced: EntityUpdate | Array<EntityUpdate> | null;
        try {
            produced = mapping.config.updates(event);
        } catch (error) {
            this.#on_error(error as Error);
            return null;
        }

        if (produced === null || produced === undefined) {
            this.#stats.dropped("no_updates", index);
            return null;
        }

        const updates = Array.isArray(produced) ? produced : [produced];
        if (updates.length === 0) {
            this.#stats.dropped("no_updates", index);
            return null;
        }

        // The id is the only part of an entry the pipeline cannot work without — see `hasUsableId`.
        let usable = updates;
        if (!updates.every(hasUsableId)) {
            usable = updates.filter(hasUsableId);
            for (let dropped = usable.length; dropped < updates.length; dropped++) {
                this.#stats.dropped("no_id", index);
            }
            this.#reporter.warnOnce(
                `no-id:${index}`,
                `[ingestion-pipeline] Mapping #${index} produced an update with no usable \`id\` for an event ` +
                    `on channel "${event.channel}"; ignoring such updates. Its \`updates\` must return ` +
                    `\`{ id, update }\` entries.`,
            );
        }

        const installed = this.#installContinuations(mapping, usable, event);
        if (installed.length === 0) {
            // Every entry was a motion already over on its first sample. Counted, so `events_dropped`
            // never lands with nothing in `drops` — which reads as the pipeline losing the event
            // rather than the mapping declining it. `usable` is empty only when `no_id` already
            // counted every entry.
            if (usable.length > 0) {
                this.#stats.dropped("no_updates", index);
            }
            return null;
        }
        return installed;
    }

    /**
     * Install every continuation this event produced, and turn each into the patch it is worth right
     * now, so the entity moves on the event rather than waiting for the first tick.
     *
     * Installing here — where `updates` ran, once per event — is what keeps a continuation shared by
     * every bound scene instead of one per session.
     */
    #installContinuations(
        mapping: CompiledMapping,
        updates: Array<EntityUpdate>,
        event: IngestEvent,
    ): Array<EntityUpdate> {
        if (!updates.some(entry => isContinuousUpdate(entry.update))) {
            return updates;
        }

        const entries: Array<EntityUpdate> = [];

        for (const entry of updates) {
            const update = entry.update;
            if (!isContinuousUpdate(update)) {
                entries.push(entry);
                continue;
            }

            const id = String(entry.id);
            mapping.continuations.set(id, { update, since_seconds: 0, event });

            // `delta_seconds` is 0 here: the install itself covers no time, so a value integrated
            // with it starts from wherever the entity's state already stood.
            const sampled = this.#sample(mapping, id, update, { delta_seconds: 0, since_seconds: 0 });
            // A continuation that is already done on its first sample never had anything to say.
            if (sampled === null) {
                mapping.continuations.delete(id);
                continue;
            }
            entries.push({ id: entry.id, update: sampled });
        }

        return entries;
    }

    /**
     * Resolve and apply every update of one mapping in one bound scene.
     *
     * @param from_tick - Whether these came from a clock tick rather than an event, which is what
     * decides whether a miss is worth counting: `drops` is an event-level story, and a continuation
     * driving an id one scene does not have would otherwise post a drop thirty times a second.
     *
     * @returns Whether at least one update reached an entity.
     */
    async #applyToBinding(
        binding: PipelineBinding,
        state: BindingState,
        index: number,
        updates: Array<PendingUpdate>,
        { from_tick }: { from_tick: boolean },
    ): Promise<boolean> {
        const { resolver, applier } = state.slots[index];

        // Nothing here can address an entity that does not exist yet: a scene pulling others in
        // through `scene_ref` components is streamed in progressively, and resolving against a
        // half-loaded one would answer misses for entities that are simply still on their way.
        //
        // This wait has no deadline of its own, so a scene the server never reports as loaded parks
        // every event and every tick until the session disconnects — which settles them all and lets
        // them drain. Deliberate: a scene still loading has nothing to drive, and going ahead would
        // only cache misses for entities that are on their way.
        await state.scene.waitForSceneLoaded();

        const results = await Promise.all(
            updates.map(async ({ entry, event }) => {
                const id = String(entry.id);
                // The resolver caches every answer, misses included, so a tick costs a map lookup
                // rather than a trip through the mapping's own `byName` / `resolve`.
                const entity = await resolver.resolve({ id, event });
                if (!entity) {
                    if (!from_tick) {
                        this.#stats.dropped("unresolved_entity", index);
                    }
                    // A continuation is deliberately left installed. This runs once per bound scene
                    // against a map shared by all of them, so uninstalling would stop the motion in
                    // every other scene — and at bring-up it would stop it inside the very
                    // `ingest()` that installed it. The scene's own `on-entities-created` drops the
                    // cached miss, so the motion starts by itself once the entity appears.
                    return false;
                }
                // The scene may have gone while the resolution was in flight: writing now would
                // drive a session this pipeline no longer has anything to do with.
                if (!this.#bindings.has(binding)) {
                    return false;
                }
                try {
                    await this.#applyUpdate({
                        scene: state.scene,
                        entity,
                        update: entry.update,
                        resolver,
                        applier,
                        id,
                        index,
                    });
                    return true;
                } catch (error) {
                    this.#on_error(error as Error);
                    return false;
                }
            }),
        );
        return results.some(Boolean);
    }

    /**
     * Apply one entry's update to its entity: component patches, or a whole-entity directive.
     *
     * A `"delete"` drops the id from the resolver explicitly: `Scene.deleteEntities` does not
     * announce a deletion the client performed itself (it empties its registry, so the server's echo
     * then matches nothing), so the resolver's `on-entities-deleted` listener — which does cover
     * deletions by *other* clients — never fires for this one.
     */
    async #applyUpdate({
        scene,
        entity,
        update,
        resolver,
        applier,
        id,
        index,
    }: {
        scene: Scene;
        entity: Entity;
        update: EntityUpdate["update"];
        resolver: EntityResolver;
        applier: ComponentPatchApplier;
        id: string;
        index: number;
    }): Promise<void> {
        if (typeof update === "string") {
            switch (update) {
                case "delete":
                    await scene.deleteEntities({ entities: [entity] });
                    resolver.forget(id);
                    // Whatever this entity was doing, it is not doing it any more — and the state it
                    // was doing it with goes with it, so an id that comes back starts clean.
                    this.#mappings[index].continuations.delete(id);
                    this.#mappings[index].states.delete(id);
                    break;
                case "hide":
                    entity.is_visible = false;
                    // Nothing anyone can see is moving, so stop paying thirty writes a second for
                    // it. The entity's state stays — a later event can pick the motion back up from
                    // where it left off, which is what "hide" rather than "delete" asked for.
                    this.#mappings[index].continuations.delete(id);
                    break;
                case "show":
                    entity.is_visible = true;
                    break;
                default:
                    // A string that is not a directive is a mapping bug, not a silent no-op: report
                    // it rather than counting it as something that reached the scene.
                    this.#on_error(
                        new Error(
                            `Mapping #${index} returned "${update}", which is not an entity directive ` +
                                `("delete", "hide" or "show"); ignoring it.`,
                        ),
                    );
                    return;
            }
            this.#stats.applied({ mapping_index: index, written: 0, deduped: 0, directive: true });
            return;
        }

        if (typeof update === "function") {
            // A bare function is not a motion — `continuous()` is. Caught here rather than passed to
            // the applier, which would write a function's enumerable properties (nothing at all) and
            // silently move nothing.
            this.#on_error(
                new Error(
                    `Mapping #${index} returned a bare function as an \`update\`; ignoring it. ` +
                        `Wrap it in \`continuous(fn)\` to declare an entity that keeps moving between events.`,
                ),
            );
            return;
        }

        if (isContinuousUpdate(update)) {
            // Unreachable: continuations are installed and sampled into patches before they get here.
            this.#on_error(
                new Error(
                    `Mapping #${index} produced a continuous update that reached the applier unsampled; ` +
                        `ignoring it. This is an SDK bug, please report it.`,
                ),
            );
            return;
        }

        const { written, deduped } = applier.apply({ entity, updates: update as ComponentUpdates });
        this.#stats.applied({ mapping_index: index, written, deduped, directive: false });
    }

    /**
     * Validate the event payload against the mapping's schema: the first matching event always,
     * every event when the `validate` option is on. Mappings without a schema always pass.
     */
    async #validatePayload(mapping: CompiledMapping, event: IngestEvent): Promise<boolean> {
        const schema = mapping.config.schema;
        if (!schema) {
            return true;
        }
        if (!this.#validate_all && mapping.validated_first) {
            return true;
        }
        mapping.validated_first = true;

        // Lazy ajv import + compilation, shared across events; a schema that cannot compile (or a
        // missing ajv install) is reported once and skips validation from then on.
        mapping.validator_promise ??= SchemaValidator.create({ schema });
        let validator: SchemaValidator;
        try {
            validator = await mapping.validator_promise;
        } catch (error) {
            this.#reporter.warnOnce(
                `validator:${event.channel}`,
                `[ingestion-pipeline] ${error instanceof Error ? error.message : String(error)}`,
            );
            return true;
        }

        const result = validator.validate(event.payload);
        if (!result.valid) {
            this.#reporter.warnOnce(
                `invalid:${result.errors}`,
                `[ingestion-pipeline] Event on channel "${event.channel}" does not match the mapping's schema: ` +
                    result.errors,
            );
            return false;
        }
        return true;
    }
}

/**
 * Whether an update entry carries an id the pipeline can resolve.
 *
 * Not defensive typing, despite `id` being typed: `String(undefined)` is `"undefined"`, a
 * valid-looking id that would silently drive — or spawn — one wrong entity for every entry missing
 * one. And it is reachable from clean TypeScript through the documented idiom, since
 * `event.channel.split("/")[3]` is typed `string` but is `undefined` on a shorter channel. Catching
 * it here turns that into a counted `no_id` drop and one warning.
 */
function hasUsableId(entry: EntityUpdate): boolean {
    return typeof entry.id === "string" || typeof entry.id === "number";
}

/**
 * Check a mapping is well-formed, at construction rather than on the first event (or, for
 * `entities`, rather than on the first `bind`, where the failure would surface from a session-ready
 * handler and read as a session error).
 *
 * Neither condition is reachable from TypeScript; this is what a JavaScript consumer gets in place
 * of a compile error, so both messages name the whole shape rather than the missing key.
 */
function validateMapping(config: EventMapping, index: number): void {
    const entities = config.entities as SceneEntities | undefined;
    if (
        entities === undefined ||
        (entities.byName === undefined &&
            entities.byUuid === undefined &&
            entities.resolve === undefined &&
            entities.spawn === undefined)
    ) {
        throw new Error(
            `Mapping #${index}: \`entities\` must declare exactly one of \`byName\`, \`byUuid\`, ` +
                `\`resolve\` (entities already in the scene) or \`spawn\` (one created per new id).`,
        );
    }
    if (typeof config.updates !== "function") {
        throw new Error(
            `Mapping #${index}: \`updates\` must be a function of the event, returning one ` +
                `\`{ id, update }\` entry, an array of them, or null.`,
        );
    }
}

/**
 * Build the resolver of one mapping for one scene, per its `entities` declaration. Total: a mapping
 * declaring no strategy was rejected at construction by {@link validateMapping}.
 */
function createResolver(entities: SceneEntities, scene: Scene, manage_auto_broadcast: boolean): EntityResolver {
    return entities.spawn !== undefined
        ? new SpawningEntityResolver({ scene, template: entities.spawn, manage_auto_broadcast })
        : new ExistingEntityResolver({ scene, lookup: entities, manage_auto_broadcast });
}

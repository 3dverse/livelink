//------------------------------------------------------------------------------
import type { Entity } from "@livelink.base/scene/Entity";
import type { Scene } from "@livelink.base/scene/Scene";

//------------------------------------------------------------------------------
import type { IngestEvent } from "./IngestEvent";
import type { ComponentUpdates, EntityUpdate, EventMapping, SceneEntities } from "./EventMapping";
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
 * One mapping and its schema-validation state, held once for the pipeline's lifetime.
 */
type CompiledMapping = {
    config: EventMapping;
    validator_promise: Promise<SchemaValidator> | null;
    validated_first: boolean;
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
            return { config, validator_promise: null, validated_first: false };
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
        return this.#stats.snapshot({ bound_scene_count: this.#bindings.size });
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
                this.#applyToBinding(binding, state, index, updates, event),
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

        // The id is the only part of an entry the pipeline cannot work without. A mapping ported
        // from an older SDK — whose `updates` returned bare component patches — lands exactly here,
        // hence the hint in the warning.
        if (updates.every(hasUsableId)) {
            return updates;
        }
        const usable = updates.filter(hasUsableId);
        for (let dropped = usable.length; dropped < updates.length; dropped++) {
            this.#stats.dropped("no_id", index);
        }
        this.#reporter.warnOnce(
            `no-id:${index}`,
            `[ingestion-pipeline] Mapping #${index} produced an update with no usable \`id\` for an event ` +
                `on channel "${event.channel}"; ignoring such updates. Its \`updates\` must return ` +
                `\`{ id, update }\` entries.`,
        );
        return usable.length > 0 ? usable : null;
    }

    /**
     * Resolve and apply every update of one mapping in one bound scene.
     *
     * @returns Whether at least one update reached an entity.
     */
    async #applyToBinding(
        binding: PipelineBinding,
        state: BindingState,
        index: number,
        updates: Array<EntityUpdate>,
        event: IngestEvent,
    ): Promise<boolean> {
        const { resolver, applier } = state.slots[index];

        const results = await Promise.all(
            updates.map(async entry => {
                const id = String(entry.id);
                const entity = await resolver.resolve({ id, event });
                if (!entity) {
                    this.#stats.dropped("unresolved_entity", index);
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
                    break;
                case "hide":
                    entity.is_visible = false;
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
 * Whether an update entry carries an id the pipeline can resolve. Guards the one field of an
 * {@link EntityUpdate} that has no sensible default.
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

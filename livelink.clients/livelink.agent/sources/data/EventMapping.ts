//------------------------------------------------------------------------------
import type { UUID, ComponentsManifest } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import type { IngestEvent } from "./IngestEvent";
import type { JsonSchema } from "./SchemaValidator";
import type { EntityMap, MappedEntity } from "./resolvers/ExistingEntityResolver";
import type { EntityTemplate } from "./resolvers/SpawningEntityResolver";

/**
 * The component patches to apply to one entity, keyed by component name. Values are partial
 * component values, applied through `entity.updateComponent` (which merges top-level attributes).
 *
 * @category Data
 */
export type ComponentUpdates = ComponentsManifest;

/**
 * A whole-entity action, written instead of component patches when an event does not *change* the
 * entity but changes whether it is there at all — a device leaving the fleet, a machine part going
 * out of service.
 *
 * - `"delete"` removes the entity from the scene (and forgets its resolution, so a later event
 *   carrying the same id resolves — or respawns — it);
 * - `"hide"` / `"show"` toggle `entity.is_visible`, keeping the entity and its resolution.
 *
 * Both `"delete"` and `"hide"` also stop a {@link continuous} update driving that id — nothing
 * visible is moving, so nothing should be written for it. `"delete"` drops the entity's state with
 * it; `"hide"` keeps it, so a later event resumes the motion from where it stopped rather than from
 * the beginning.
 *
 * @category Data
 */
export type EntityDirective = "delete" | "hide" | "show";

/**
 * Brands a {@link ContinuousUpdate}, so a plain function is never mistaken for one. Not a lock —
 * `Symbol.for` is reachable by string, and building the object by hand is a supported (if verbose)
 * alternative to {@link continuous}. It exists so `update: () => buildPatch(payload)`, a plausible
 * slip, cannot be read as a motion.
 *
 * Registered rather than module-private on two counts: two copies of the package loaded side by side
 * still recognise each other's continuations, and `tsc` cannot emit a declaration file for a type
 * keyed on a symbol it cannot name.
 *
 * @internal
 */
export const CONTINUOUS_UPDATE: unique symbol = Symbol.for("@3dverse/livelink-agent.continuous");

/**
 * What a {@link ContinuousUpdate} is handed every time it is sampled.
 *
 * @category Data
 */
export type ContinuousUpdateContext<TState extends object = Record<string, never>> = {
    /**
     * Seconds since the previous sample, and `0` on the event that installs the continuation — so a
     * value integrated with it (`state.x += rate * delta_seconds`) never double-counts the install,
     * and never runs away as re-reading {@link since_seconds} would.
     *
     * This is the one to reach for when a value **accumulates**; use {@link since_seconds} when it is
     * a closed-form function of how long the motion has been running.
     */
    delta_seconds: number;

    /**
     * Seconds since this continuation was installed — since the event that set the rate. `0` on that
     * installing event.
     */
    since_seconds: number;

    /**
     * Scratch space belonging to the **entity**, not to this motion: it outlives the event that
     * replaces the continuation, so a shaft told a new rpm carries on from the angle it had reached
     * rather than snapping back to zero. It is dropped only when the entity is deleted.
     *
     * This is what a mapping would otherwise keep in a `Map` of its own, with the phase read at event
     * time and written back on every tick — a pattern that is one misplaced read away from
     * accelerating forever.
     */
    state: TState;
};

/**
 * An update that keeps producing values after the event that installed it. Build one with
 * {@link continuous}.
 *
 * Some events carry a **rate**, not a value — "the shaft is turning at 90 rpm". A rate still means
 * something once the message that delivered it is gone, so a mapping that returned a finished patch
 * would leave the entity frozen until the next message. Returning one of these instead says *what
 * the entity is doing*, and the pipeline re-samples it on its own clock until a later event for the
 * same id replaces it.
 *
 * @category Data
 */
export type ContinuousUpdate<TState extends object = Record<string, never>> = {
    /** @internal */
    readonly [CONTINUOUS_UPDATE]: true;

    /**
     * Where the entity is *now*. Returns component patches, a whole-entity {@link EntityDirective}
     * (so a motion can end by hiding or deleting what it was driving — both also uninstall it), or
     * `null` when the motion is over — the continuation is then forgotten and the entity keeps its
     * last value.
     */
    sample(context: ContinuousUpdateContext<TState>): ComponentUpdates | EntityDirective | null;

    /**
     * The state to start from. Used **only** the first time this entity is given a state, so a later
     * event does not reset a motion already under way.
     */
    readonly initial_state?: TState;
};

/**
 * A {@link ContinuousUpdate} whose state type has been erased — what an {@link EntityUpdate} holds,
 * since one `updates` call may return several continuations, each with its own state shape.
 *
 * @category Data
 */
// The single point where `TState` is erased. `state` sits in both a parameter and a property
// position, so no concrete type (not `unknown`, not `never`) accepts every `ContinuousUpdate<T>`;
// the pipeline never reads the state, it only hands it back to the mapping that owns it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyContinuousUpdate = ContinuousUpdate<any>;

/**
 * Declare that an entity **keeps moving** between events, instead of writing one finished value.
 *
 * The function is re-sampled on the pipeline's clock until a later event for the same id replaces
 * it, it returns `null` when the motion is over, and `state` is scratch space that survives those
 * replacements — which is exactly what a phase needs:
 *
 * ```typescript
 * updates: event => {
 *     const rpm = (event.payload as { rpm: number }).rpm;
 *     return {
 *         id: event.channel.split("/")[2],
 *         update: continuous<{ angle_deg: number }>(
 *             ({ delta_seconds, state }) => {
 *                 // 360 degrees a turn, 60 seconds a minute.
 *                 state.angle_deg = (state.angle_deg + rpm * 6 * delta_seconds) % 360;
 *                 return { local_transform: { eulerOrientation: [state.angle_deg, 0, 0] } };
 *             },
 *             { initial_state: { angle_deg: 0 } },
 *         ),
 *     };
 * };
 * ```
 *
 * A motion runs until something replaces or stops it: a later event for the same id, a sample
 * returning `null`, a `"hide"` or `"delete"`, or {@link IngestionPipeline.clearContinuations}. An
 * event whose `updates` returns `null` is **not** one of those — it means "this message said nothing
 * about this entity", so a topic carrying payloads of several shapes leaves the motion alone.
 *
 * Wrapping is not ceremony: it is what keeps `update: () => buildPatch(payload)` — a plausible
 * slip, and a perfectly well-typed function — from silently installing a motion that never stops.
 *
 * @param sample - Where the entity is now, given the time elapsed and its own state.
 * @param options - `initial_state` for the value the entity's state starts at.
 *
 * @category Data
 */
export function continuous<TState extends object = Record<string, never>>(
    sample: (context: ContinuousUpdateContext<TState>) => ComponentUpdates | EntityDirective | null,
    options: { initial_state?: TState } = {},
): ContinuousUpdate<TState> {
    return {
        [CONTINUOUS_UPDATE]: true,
        sample,
        initial_state: options.initial_state,
    };
}

/**
 * Whether an {@link EntityUpdate.update} is a motion rather than a patch or a directive.
 *
 * @internal
 */
export function isContinuousUpdate(update: EntityUpdate["update"]): update is AnyContinuousUpdate {
    return typeof update === "object" && update !== null && CONTINUOUS_UPDATE in update;
}

/**
 * One entity driven by an event: the id addressing it, and what the event does to it. This is what
 * an {@link EventMapping.updates} function returns — one of these, or an array of them.
 *
 * @category Data
 */
export type EntityUpdate = {
    /**
     * The unique id of the object this update addresses — whatever that object is in the use case
     * (an AGV serial number, a machine part id, ...). It is resolved to an actual scene entity
     * through the mapping's {@link EventMapping.entities}.
     */
    id: string | number;

    /**
     * What the event does to that entity: component patches, a whole-entity {@link EntityDirective},
     * or a {@link continuous} update for something that keeps moving between events.
     */
    update: ComponentUpdates | EntityDirective | AnyContinuousUpdate;
};

/**
 * How an id from the event stream finds an entity **already present** in the scene. Exactly one of:
 *
 * - `byName` — the entity whose *name* the id produces, from a pattern embedding `{id}` (or a
 *   function). Use it when the scene names its entities after the ids the stream carries: it removes
 *   the need to collect and configure UUIDs entirely;
 * - `byUuid` — a fixed `id → entity UUID` table, for a known, closed population (the moving parts
 *   of one machine);
 * - `resolve` — a function, for anything else (a lookup service, a naming convention with
 *   exceptions, an id needing normalization).
 *
 * @category Data
 */
export type EntityLookup = {
    /**
     * The linkage to find the entities under — the chain of scene references leading to them, empty
     * (the default) for entities of the scene itself. A `byUuid` entry declaring its own linkage wins.
     */
    linkage?: Array<UUID>;
} & (
    | { byName: string | ((params: { id: string; event: IngestEvent }) => string); byUuid?: never; resolve?: never }
    | { byUuid: EntityMap; byName?: never; resolve?: never }
    | {
          resolve: (params: {
              id: string;
              event: IngestEvent;
          }) => UUID | MappedEntity | null | Promise<UUID | MappedEntity | null>;
          byName?: never;
          byUuid?: never;
      }
);

/**
 * The entities **of the 3dverse scene** a mapping drives, and how an id carried by its events finds
 * — or creates — one of them. Exactly one of four strategies:
 *
 * - `byName` — the entity whose *name* the id produces (a pattern embedding `{id}`, or a function);
 * - `byUuid` — a fixed `id → entity UUID` table;
 * - `resolve` — an arbitrary function, for lookups the two above cannot express;
 * - `spawn` — no pre-existing entity: one is **created** per new id, from a template. Use it when
 *   the stream itself defines the population (one entity per device serial number).
 *
 * The first three find entities already in the scene and accept a `linkage` (see
 * {@link EntityLookup}); `spawn` creates at the scene root, and so takes none.
 *
 * @category Data
 */
export type SceneEntities =
    | (EntityLookup & { spawn?: never })
    | { spawn: EntityTemplate; byName?: never; byUuid?: never; resolve?: never; linkage?: never };

/**
 * Describes how ONE event type drives entities in the scene: which events it covers (`channel` /
 * `when`), which entities those events drive (`entities`), and what each event does to them
 * (`updates`).
 *
 * A source carrying several event types (e.g. one schema per MQTT topic family) uses several
 * mappings — each event is handled by every mapping whose selectors match it.
 *
 * `updates` returns one {@link EntityUpdate} when an event is about a single object:
 *
 * ```typescript
 * const mapping: EventMapping = {
 *     channel: "uagv/+/+/+/visualization",
 *     entities: { spawn: { name: "AGV-{id}", components: { scene_ref: { value: SCENE } } } },
 *     updates: event => ({
 *         id: event.channel.split("/")[3], // the serial number, from the topic
 *         update: { local_transform: agvPoseToTransform(event.payload.agvPosition) },
 *     }),
 * };
 * ```
 *
 * ...or an array of them when one event carries the state of several objects at once, the norm for a
 * machine publishing a whole-state frame:
 *
 * ```typescript
 * const mapping: EventMapping = {
 *     entities: { byName: "{id}" },
 *     updates: ({ payload }) => [
 *         { id: "blade", update: { local_transform: { eulerOrientation: [0, payload.angle, 0] } } },
 *         { id: "carriage", update: { local_transform: { position: [0, payload.posZ, 0] } } },
 *     ],
 * };
 * ```
 *
 * @category Data
 */
export type EventMapping = {
    /**
     * Only handle events whose channel matches this MQTT-style pattern (`+`/`*` = one segment,
     * trailing `#` = the rest). Omitted = all channels.
     *
     * Note that `channel` is only a meaningful selector on transports that put routing information
     * in it — see {@link IngestEvent.channel}. On an Azure Event Hub stream, select with `when`
     * instead.
     */
    channel?: string;

    /**
     * Only handle events for which this predicate returns true. Omitted = all events.
     */
    when?: (event: IngestEvent) => boolean;

    /**
     * JSON Schema of this event type. The **first** matching event is validated against it (a
     * cheap sanity check of the stream's shape); every event is validated when the
     * pipeline's `validate` option is on (debugging).
     */
    schema?: JsonSchema;

    /**
     * The scene entities this mapping's events drive, and how the ids they carry find — or create —
     * one. See {@link SceneEntities}.
     */
    entities: SceneEntities;

    /**
     * What one event does: one {@link EntityUpdate} when it is about a single object, an array of
     * them when it carries several at once. Return `null` (or an empty array) to ignore the event.
     *
     * The whole event is passed, so an id can come from the payload, the channel, the metadata, or
     * several fields combined.
     *
     * Note that extracting this function to a bare `const` loses TypeScript's contextual typing of
     * its parameter; annotate it `EventMapping["updates"]` if you do.
     */
    updates: (event: IngestEvent) => EntityUpdate | Array<EntityUpdate> | null;
};

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
 * entity but changes whether it is there at all — a vehicle leaving the fleet, a machine part going
 * out of service.
 *
 * - `"delete"` removes the entity from the scene (and forgets its resolution, so a later event
 *   carrying the same id resolves — or respawns — it);
 * - `"hide"` / `"show"` toggle `entity.is_visible`, keeping the entity and its resolution.
 *
 * @category Data
 */
export type EntityDirective = "delete" | "hide" | "show";

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
     * What the event does to that entity: component patches, or a whole-entity
     * {@link EntityDirective}.
     */
    update: ComponentUpdates | EntityDirective;
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
 *   the stream itself defines the population (one entity per vehicle serial number).
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

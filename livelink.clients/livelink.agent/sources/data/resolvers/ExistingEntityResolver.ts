//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink.core";
import type { Entity } from "@livelink.base/scene/Entity";
import type { Scene } from "@livelink.base/scene/Scene";

//------------------------------------------------------------------------------
import type { IngestEvent } from "../IngestEvent";
import type { EntityLookup } from "../EventMapping";
import { CachingEntityResolver } from "./EntityResolver";

/**
 * One entry of an {@link EntityMap}: the UUID of the entity an id drives, either bare or paired with
 * the linkage to find it under (the chain of scene references leading to it, empty for an entity of
 * the scene itself). A bare UUID takes the linkage declared alongside the map.
 *
 * @category Data
 */
export type MappedEntity = {
    /**
     * The UUID of the existing entity the id drives.
     */
    entity_uuid: UUID;

    /**
     * The linkage to find this entity under. Overrides the linkage declared alongside the map when
     * defined.
     */
    linkage?: Array<UUID>;
};

/**
 * The mapping of ids (as carried by the events) to the existing entities they drive — the `byUuid`
 * strategy of an {@link EntityLookup}.
 *
 * @category Data
 */
export type EntityMap = Record<string, UUID | MappedEntity>;

/**
 * Whether an entity sits under exactly the given linkage — the same lineage test
 * `Scene.findEntity` applies, needed because name lookups cannot express one.
 */
function isUnderLinkage(entity: Entity, linkage: Array<UUID>): boolean {
    const lineage = entity.lineage?.value ?? [];
    return lineage.length === linkage.length && lineage.every((uuid, index) => uuid === linkage[index]);
}

/**
 * Resolves ids against entities **already present** in the scene, through any of the three
 * {@link EntityLookup} strategies:
 *
 * - `byName` — the entity whose *name* the id produces (pattern with `{id}`, or a function), so a
 *   scene that names its entities after the ids the stream carries needs no UUID configuration at
 *   all;
 * - `byUuid` — a fixed `id → entity UUID` table, for a known, closed population;
 * - `resolve` — an arbitrary function, for lookups the two above cannot express.
 *
 * Ids that resolve to nothing, or to an entity missing from the scene, resolve to null with a
 * single warning — and are retried automatically once any entity appears in the scene (see
 * {@link CachingEntityResolver}).
 *
 * @internal
 */
export class ExistingEntityResolver extends CachingEntityResolver {
    /**
     * The lookup strategy and its shared linkage.
     */
    readonly #lookup: EntityLookup;

    /**
     * The linkage applied to the lookups that do not define one of their own.
     */
    readonly #linkage: Array<UUID>;

    /**
     * What each id that failed to resolve was looking for — a name for `byName`, a UUID for
     * `byUuid` / `resolve` — so a later creation only triggers another lookup when it could actually
     * satisfy it. See {@link CachingEntityResolver._couldBeSatisfiedBy}.
     */
    readonly #sought = new Map<string, { name?: string; entity_uuid?: UUID }>();

    /**
     * @param params
     * @param params.scene - The scene holding the pre-existing entities.
     * @param params.lookup - The lookup strategy (`byName`, `byUuid` or `resolve`) and its linkage.
     * @param params.manage_auto_broadcast - Whether to force `auto_broadcast = false` on the entity
     * resolved for each new id. Defaults to `true`. See {@link CachingEntityResolver}.
     */
    constructor({
        scene,
        lookup,
        manage_auto_broadcast,
    }: {
        scene: Scene;
        lookup: EntityLookup;
        manage_auto_broadcast?: boolean;
    }) {
        super({ scene, manage_auto_broadcast: manage_auto_broadcast ?? true });
        this.#lookup = lookup;
        this.#linkage = lookup.linkage ?? [];
    }

    /**
     * Produce the entity for the given id and event.
     */
    protected async _produce({ id, event }: { id: string; event: IngestEvent }): Promise<Entity | null> {
        // Cleared up front, so what is remembered is always this attempt's outcome: the lookup paths
        // below record what they failed to find, and record nothing when they succeed.
        this.#sought.delete(id);

        if (this.#lookup.byName !== undefined) {
            return this.#produceByName({ id, event });
        }
        return this.#produceByUuid({ id, event });
    }

    /**
     * Resolve through the `byName` strategy: find the entity carrying the name the id produces,
     * keeping only the candidates sitting under the configured linkage.
     */
    async #produceByName({ id, event }: { id: string; event: IngestEvent }): Promise<Entity | null> {
        const by_name = this.#lookup.byName!;
        const name = typeof by_name === "function" ? by_name({ id, event }) : by_name.replaceAll("{id}", id);

        const candidates = await this._scene.findEntitiesByNames({ entity_names: [name] });
        const matching = candidates.filter(entity => isUnderLinkage(entity, this.#linkage));

        if (matching.length === 0) {
            this.#sought.set(id, { name });
            this._warnOnce({
                id,
                message:
                    `[entity-resolver] No entity named "${name}" (id "${id}") found in the scene` +
                    `${this.#linkage.length > 0 ? ` under linkage [${this.#linkage.join(", ")}]` : ""}; ` +
                    `ignoring its events until one appears.`,
            });
            return null;
        }
        if (matching.length > 1) {
            this._warnOnce({
                id,
                message:
                    `[entity-resolver] ${matching.length} entities are named "${name}" (id "${id}"); ` +
                    `driving the first one. Give them distinct names, or use a linkage, to disambiguate.`,
            });
        }
        return matching[0];
    }

    /**
     * Resolve through the `byUuid` or `resolve` strategies, both of which produce a UUID (+ optional
     * per-entry linkage) to look up.
     */
    async #produceByUuid({ id, event }: { id: string; event: IngestEvent }): Promise<Entity | null> {
        const entry = this.#lookup.resolve
            ? await this.#lookup.resolve({ id, event })
            : (this.#lookup.byUuid?.[id] ?? null);

        if (!entry) {
            this._warnOnce({
                id,
                message: `[entity-resolver] No entity mapping for id "${id}"; ignoring its events.`,
            });
            return null;
        }

        const entity_uuid = typeof entry === "string" ? entry : entry.entity_uuid;
        const linkage = (typeof entry === "string" ? undefined : entry.linkage) ?? this.#linkage;

        const entity = await this._scene.findEntity({ entity_uuid, linkage });
        if (!entity) {
            this.#sought.set(id, { entity_uuid });
            this._warnOnce({
                id,
                message: `[entity-resolver] Entity ${entity_uuid} (id "${id}") not found in the scene; ignoring its events.`,
            });
        }
        return entity;
    }

    /**
     * Retry an unresolved id only when one of the entities that just appeared carries the name (or
     * the UUID) that id was looking for. An id whose lookup never got that far — a `resolve`
     * function returning null, an unmapped id — has nothing to match on, so it keeps the broad
     * retry.
     */
    protected override _couldBeSatisfiedBy({ id, created }: { id: string; created: Array<Entity> }): boolean {
        const sought = this.#sought.get(id);
        if (!sought) {
            return true;
        }
        return created.some(entity => entity.name === sought.name || entity.id === sought.entity_uuid);
    }
}

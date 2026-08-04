//------------------------------------------------------------------------------
import type { Entity } from "@livelink.base/scene/Entity";
import type { Scene } from "@livelink.base/scene/Scene";
import type { EntitiesCreatedEvent, EntitiesDeletedEvent } from "@livelink.base/scene/SceneEvents";

//------------------------------------------------------------------------------
import type { IngestEvent } from "../IngestEvent";
import { WarnOnceReporter } from "../util/reporting";

/**
 * Resolves the entity an ingested event addresses, from the unique id extracted from the
 * event (a serial number, a part id, ...).
 *
 * The SDK ships two strategies:
 * - {@link ExistingEntityResolver}: ids address entities already in the scene (by map, by name, or
 *   through a resolve function),
 * - {@link SpawningEntityResolver}: an entity is spawned live for each new id.
 *
 * @internal
 */
export interface EntityResolver {
    /**
     * Resolve the entity for an id, or null when it cannot be resolved (unknown id, entity
     * not found, creation failed...).
     */
    resolve(params: { id: string; event: IngestEvent }): Promise<Entity | null>;

    /**
     * Drop whatever is remembered about an id, so the next event carrying it resolves afresh.
     *
     * Called by the pipeline after a `"delete"` directive: the scene does **not** announce a
     * deletion the client itself performed, so the resolution has to be dropped explicitly (see
     * {@link CachingEntityResolver}).
     */
    forget(id: string): void;

    /**
     * Release whatever the resolver holds on the scene (event listeners, caches). Called when the
     * binding this resolver belongs to is unbound.
     */
    dispose?(): void;
}

/**
 * Base class for entity resolvers, factoring the concerns every strategy needs:
 *
 * - resolutions are cached per id (including null results, so a missing entity is looked up once),
 * - concurrent resolutions of the same id share a single in-flight production (events arriving
 *   while an entity is being looked up or created await it instead of duplicating the work),
 * - production errors are logged, not cached, and resolve to null (so the next event retries),
 * - {@link CachingEntityResolver._warnOnce} avoids log spam for repeated unresolvable ids.
 *
 * **The cache largely invalidates itself from the scene's own events**: an id that resolved to
 * nothing is retried as soon as an entity that could satisfy it appears, and a resolution is dropped
 * when another client deletes its entity.
 *
 * Unless told not to (`manage_auto_broadcast: false`), the first successful resolution of an id sets
 * `entity.auto_broadcast = false` — the entity is being driven by this stream, so it should not
 * re-broadcast those writes to other clients.
 *
 * The one case the scene cannot announce is a deletion *this* client performed — `Scene.deleteEntities`
 * removes the entities from its registry and dispatches nothing, and the server's echo then matches
 * no registered entity. So a mapping returning the `"delete"` directive has its id dropped through an
 * explicit {@link forget}, which the pipeline calls.
 *
 * Subclasses implement {@link CachingEntityResolver._produce}.
 *
 * @internal
 */
export abstract class CachingEntityResolver implements EntityResolver {
    /**
     * Resolved entities (or null when unresolvable), keyed by id.
     */
    readonly #cache = new Map<string, Entity | null>();

    /**
     * Productions in flight, to dedup concurrent resolutions of the same id.
     */
    readonly #in_flight = new Map<string, Promise<Entity | null>>();

    /**
     * Warn-once reporter shared by the strategy implementations.
     */
    readonly #reporter = new WarnOnceReporter();

    /**
     * The scene this resolver resolves against, and whose events invalidate its cache.
     */
    readonly #scene: Scene;

    /**
     * Whether the first successful resolution of an id forces `entity.auto_broadcast = false`.
     */
    readonly #manage_auto_broadcast: boolean;

    /**
     * @param params
     * @param params.scene - The scene to resolve entities against.
     * @param params.manage_auto_broadcast - Whether to force `auto_broadcast = false` on the first
     * resolution of an id. See the class doc.
     */
    constructor({ scene, manage_auto_broadcast }: { scene: Scene; manage_auto_broadcast: boolean }) {
        this.#scene = scene;
        this.#manage_auto_broadcast = manage_auto_broadcast;
        this.#scene.addEventListener("on-entities-created", this.#onEntitiesCreated);
        this.#scene.addEventListener("on-entities-deleted", this.#onEntitiesDeleted);
    }

    /**
     * The scene this resolver resolves against.
     */
    protected get _scene(): Scene {
        return this.#scene;
    }

    /**
     * Resolve the entity for an id, producing (and caching) it on first sight.
     */
    async resolve({ id, event }: { id: string; event: IngestEvent }): Promise<Entity | null> {
        const cached = this.#cache.get(id);
        if (cached !== undefined) {
            return cached;
        }

        const pending = this.#in_flight.get(id);
        if (pending) {
            return pending;
        }

        const production: Promise<Entity | null> = this._produce({ id, event })
            .then(entity => {
                if (entity && this.#manage_auto_broadcast) {
                    entity.auto_broadcast = false;
                }

                // A `forget` (or a `dispose`) landing while this was in flight drops the in-flight
                // entry; caching the result then would resurrect exactly what was asked to go.
                if (this.#in_flight.get(id) === production) {
                    this.#cache.set(id, entity);
                }
                return entity;
            })
            .catch(error => {
                console.error(`[entity-resolver] Failed to resolve entity for id "${id}":`, error);
                return null;
            })
            .finally(() => {
                if (this.#in_flight.get(id) === production) {
                    this.#in_flight.delete(id);
                }
            });

        this.#in_flight.set(id, production);
        return production;
    }

    /**
     * Drop what is remembered about an id — its cached resolution and any production in
     * flight — so the next event carrying it resolves (or respawns) afresh.
     */
    forget(id: string): void {
        this.#cache.delete(id);
        this.#in_flight.delete(id);
    }

    /**
     * Stop listening to the scene and drop everything cached.
     */
    dispose(): void {
        this.#scene.removeEventListener("on-entities-created", this.#onEntitiesCreated);
        this.#scene.removeEventListener("on-entities-deleted", this.#onEntitiesDeleted);
        this.#cache.clear();
        this.#in_flight.clear();
    }

    /**
     * Entities appeared in the scene: the ids that resolved to *nothing* and could be satisfied by
     * one of them are dropped, so they resolve again. Successful resolutions are untouched — they
     * are still valid.
     *
     * This is what makes an id mentioned by the stream before its entity exists work on its own,
     * instead of needing the caller to invalidate the cache by hand. {@link _couldBeSatisfiedBy}
     * keeps it from turning into a lookup storm when something else is spawning entities into the
     * same scene at stream rate.
     */
    #onEntitiesCreated = (event: EntitiesCreatedEvent): void => {
        for (const [id, entity] of this.#cache) {
            if (entity === null && this._couldBeSatisfiedBy({ id, created: event.entities })) {
                this.#cache.delete(id);
            }
        }
    };

    /**
     * An entity was deleted: drop the resolutions pointing at it, so the next event carrying that
     * id resolves again (and, with a spawning resolver, recreates it).
     */
    #onEntitiesDeleted = (event: EntitiesDeletedEvent): void => {
        for (const [id, entity] of this.#cache) {
            if (entity !== null && event.includes(entity)) {
                this.#cache.delete(id);
            }
        }
    };

    /**
     * Produce the entity for an id seen for the first time. Return null when the id is
     * unresolvable (the null is cached); throw to leave the id unresolved (the next event
     * retries).
     */
    protected abstract _produce(params: { id: string; event: IngestEvent }): Promise<Entity | null>;

    /**
     * Whether any of the entities that just appeared could be the one an unresolved id addresses —
     * i.e. whether it is worth paying for another lookup.
     *
     * Defaults to yes, which is always correct but re-looks-up every unresolved id on every
     * creation. A strategy that knows what it is looking for should narrow it: with a spawning
     * mapping feeding the same scene, an unnarrowed retry means one round trip per unresolved id
     * per spawn.
     */
    protected _couldBeSatisfiedBy(_params: { id: string; created: Array<Entity> }): boolean {
        return true;
    }

    /**
     * Log a warning for an id once.
     */
    protected _warnOnce({ id, message }: { id: string; message: string }): void {
        this.#reporter.warnOnce(id, message);
    }
}

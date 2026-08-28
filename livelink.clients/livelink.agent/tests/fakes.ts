import { vi } from "vitest";

import type { Agent } from "../sources/Agent";
import type { Livelink } from "../sources/Livelink";
import type { Entity } from "@livelink.base/scene/Entity";
import type { Scene } from "@livelink.base/scene/Scene";

import type { EventSink, Transport } from "../sources/data/Transport";

//------------------------------------------------------------------------------
/**
 * A minimal entity recording the components applied to it.
 */
export class FakeEntity {
    components: Record<string, unknown> = {};
    is_visible = true;
    auto_broadcast = true;
    /** Distinct per instance, so a fake delete event can address one entity. */
    readonly rtid: bigint;
    /** The chain of scene references this entity sits under; undefined = the scene itself. */
    lineage: { value: Array<string> } | undefined;
    /**
     * The entity's own UUID and name. A real entity always carries both, and the resolvers match
     * newly created entities on them to decide whether an unresolved id is worth retrying — so a
     * test that registers an entity under a UUID or a name should say so here too.
     */
    id: string;
    name: string;

    static #next_rtid = 1n;

    constructor({ id, name, lineage }: { id?: string; name?: string; lineage?: Array<string> } = {}) {
        this.rtid = FakeEntity.#next_rtid++;
        this.id = id ?? `00000000-0000-0000-0000-${String(this.rtid).padStart(12, "0")}`;
        this.name = name ?? "<unnamed>";
        this.lineage = lineage ? { value: lineage } : undefined;
    }

    updateComponent = vi.fn((name: string, value?: unknown): void => {
        if (value !== undefined) {
            this.components[name] = { ...(this.components[name] as object | undefined), ...(value as object) };
        }
    });

    asEntity(): Entity {
        return this as unknown as Entity;
    }
}

//------------------------------------------------------------------------------
/**
 * A minimal per-session scene: entities addressable by uuid and by name, spawns and deletes
 * recorded, and the two entity-lifecycle events the resolvers invalidate their caches from.
 */
export class FakeScene {
    /** Entities addressable by UUID. */
    existing = new Map<string, FakeEntity>();
    /** Entities addressable by name (several may share one, to test ambiguity). */
    named = new Map<string, Array<FakeEntity>>();
    /** Entities created through `newEntity`. */
    spawned: Array<{ name: string; entity: FakeEntity }> = [];
    /** Entities passed to `deleteEntities`. */
    deleted: Array<FakeEntity> = [];

    readonly #listeners = new Map<string, Set<(event: unknown) => void>>();

    /**
     * When set, `waitForSceneLoaded()` blocks on this promise and reports whatever it yields — the
     * pipeline waits on it before resolving anything, so a test can hold an ingest mid-flight and
     * then let the wait either succeed or time out. Absent a gate the scenes are already loaded.
     */
    scene_loaded_gate: Promise<boolean> | null = null;

    waitForSceneLoaded = vi.fn(async (): Promise<boolean> => {
        return this.scene_loaded_gate === null ? true : await this.scene_loaded_gate;
    });

    findEntity = vi.fn(async ({ entity_uuid }: { entity_uuid: string }): Promise<Entity | null> => {
        return (this.existing.get(entity_uuid) as unknown as Entity) ?? null;
    });

    findEntitiesByNames = vi.fn(async ({ entity_names }: { entity_names: Array<string> }): Promise<Array<Entity>> => {
        return entity_names.flatMap(name => (this.named.get(name) ?? []) as unknown as Array<Entity>);
    });

    newEntity = vi.fn(async ({ name }: { name: string }): Promise<Entity> => {
        const entity = new FakeEntity({ name });
        this.spawned.push({ name, entity });
        this.emitEntitiesCreated([entity]);
        return entity.asEntity();
    });

    // Deliberately emits NO `on-entities-deleted`: the real `Scene.deleteEntities` empties its
    // entity registry and dispatches nothing, and the server's echo then matches no registered
    // entity. A fake that announced its own deletions would hide the pipeline's need to `forget`.
    deleteEntities = vi.fn(async ({ entities }: { entities: Array<Entity> }): Promise<void> => {
        const deleted = entities as unknown as Array<FakeEntity>;
        this.deleted.push(...deleted);
        for (const entity of deleted) {
            for (const [name, list] of this.named) {
                this.named.set(
                    name,
                    list.filter(candidate => candidate !== entity),
                );
            }
            for (const [uuid, candidate] of this.existing) {
                if (candidate === entity) {
                    this.existing.delete(uuid);
                }
            }
        }
    });

    addEventListener = (name: string, listener: (event: unknown) => void): void => {
        (this.#listeners.get(name) ?? this.#listeners.set(name, new Set()).get(name)!).add(listener);
    };

    removeEventListener = (name: string, listener: (event: unknown) => void): void => {
        this.#listeners.get(name)?.delete(listener);
    };

    /** How many listeners the scene currently holds, to assert that unbinding releases them. */
    listenerCount(name: string): number {
        return this.#listeners.get(name)?.size ?? 0;
    }

    /** Announce entities appearing in the scene, as the real scene does. */
    emitEntitiesCreated(entities: Array<FakeEntity>): void {
        this.#emit("on-entities-created", { entities });
    }

    /** Announce entities leaving the scene, as the real scene does. */
    emitEntitiesDeleted(entities: Array<FakeEntity>): void {
        const rtids = entities.map(entity => entity.rtid);
        this.#emit("on-entities-deleted", {
            entity_ids: rtids,
            includes: (entity: FakeEntity): boolean => rtids.includes(entity.rtid),
        });
    }

    #emit(name: string, event: unknown): void {
        for (const listener of this.#listeners.get(name) ?? []) {
            listener(event);
        }
    }

    asScene(): Scene {
        return this as unknown as Scene;
    }
}

//------------------------------------------------------------------------------
export function makeLivelink(session_id: string, scene: FakeScene): Livelink {
    return { session: { session_id }, scene } as unknown as Livelink;
}

//------------------------------------------------------------------------------
/**
 * A fake Agent: records listeners by event name and lets the test emit lifecycle events.
 */
export class FakeAgent {
    #listeners = new Map<string, Set<(event: unknown) => void>>();
    start = vi.fn(async (): Promise<void> => {});
    stop = vi.fn(async (): Promise<void> => {});

    /**
     * The agent's config, as the real one exposes it — `SceneIngestion` reads
     * `headless_client.updatesPerSecond` off it to pick its default tick rate.
     */
    readonly config: { headless_client?: { updatesPerSecond?: number } };

    constructor(config: { headless_client?: { updatesPerSecond?: number } } = {}) {
        this.config = config;
    }

    addEventListener = (name: string, listener: (event: unknown) => void): void => {
        (this.#listeners.get(name) ?? this.#listeners.set(name, new Set()).get(name)!).add(listener);
    };
    removeEventListener = (name: string, listener: (event: unknown) => void): void => {
        this.#listeners.get(name)?.delete(listener);
    };
    emit(name: string, event: unknown): void {
        for (const listener of this.#listeners.get(name) ?? []) {
            listener(event);
        }
    }
    asAgent(): Agent {
        return this as unknown as Agent;
    }
}

//------------------------------------------------------------------------------
/**
 * A fake transport that captures the sink the ingestion binds to it.
 */
export class FakeTransport implements Transport {
    sink: EventSink | null = null;
    start = vi.fn(async (): Promise<void> => {});
    stop = vi.fn(async (): Promise<void> => {});
}

//------------------------------------------------------------------------------
export const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

import { beforeEach, describe, expect, it } from "vitest";
import type { UUID } from "@3dverse/livelink.core";
import { EntityRegistry } from "@livelink.base/scene/EntityRegistry";
import { createMockScene, makeEntity, makeLinkedEntities, MockScene } from "../helpers/mock-scene";

let scene: MockScene;
let registry: EntityRegistry;

beforeEach(() => {
    ({ scene, registry } = createMockScene());
});

// ---------------------------------------------------------------------------

describe("lookups", () => {
    it("finds entity by RTID", () => {
        const entity = makeEntity(scene);
        expect(registry.get({ entity_rtid: entity.rtid })).toBe(entity);
    });

    it("returns null for an unknown RTID", () => {
        expect(registry.get({ entity_rtid: 9999n })).toBeNull();
    });

    it("finds entities by EUID", () => {
        const entity = makeEntity(scene);
        expect(registry.find({ entity_euid: entity.id })).toContain(entity);
    });

    it("returns an empty array for an unknown EUID", () => {
        expect(registry.find({ entity_euid: "00000000-0000-0000-0000-000000000000" })).toHaveLength(0);
    });

    it("all() yields every registered entity", () => {
        const a = makeEntity(scene);
        const b = makeEntity(scene);
        expect(Array.from(registry.all())).toEqual(expect.arrayContaining([a, b]));
    });
});

// ---------------------------------------------------------------------------

describe("multi-instance (shared EUID)", () => {
    // Simulates a SceneRef instanced twice: same entity EUID, different linker chains.
    it("stores two instances of the same entity EUID with distinct linkages", () => {
        const euid = crypto.randomUUID() as UUID;
        const linkerA = crypto.randomUUID() as UUID;
        const linkerB = crypto.randomUUID() as UUID;
        const [a, b] = makeLinkedEntities(scene, euid, [[linkerA], [linkerB]]);
        expect(registry.find({ entity_euid: euid })).toEqual(expect.arrayContaining([a, b]));
    });

    it("removing one instance leaves the other registered", () => {
        const euid = crypto.randomUUID() as UUID;
        const linkerA = crypto.randomUUID() as UUID;
        const linkerB = crypto.randomUUID() as UUID;
        const [a, b] = makeLinkedEntities(scene, euid, [[linkerA], [linkerB]]);

        registry.remove({ entity: a });

        expect(registry.find({ entity_euid: euid })).toEqual([b]);
        expect(registry.get({ entity_rtid: a.rtid })).toBeNull();
        expect(registry.get({ entity_rtid: b.rtid })).toBe(b);
    });

    it("_removeAll removes every instance of a given EUID", () => {
        const euid = crypto.randomUUID() as UUID;
        const linkerA = crypto.randomUUID() as UUID;
        const linkerB = crypto.randomUUID() as UUID;
        makeLinkedEntities(scene, euid, [[linkerA], [linkerB]]);

        const removed = registry._removeAll({ entity_euid: euid });

        expect(removed).toHaveLength(2);
        expect(registry.find({ entity_euid: euid })).toHaveLength(0);
    });

    it("_removeAll returns empty array for an unknown EUID", () => {
        const removed = registry._removeAll({ entity_euid: "00000000-0000-0000-0000-000000000000" });
        expect(removed).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe("add / remove", () => {
    it("throws when adding an entity whose RTID is already registered", () => {
        const entity = makeEntity(scene);
        // Entity constructor already called registry.add(); calling it again must throw.
        expect(() => registry.add({ entity })).toThrow();
    });

    it("throws when removing an entity that was never registered", () => {
        const { scene: otherScene } = createMockScene();
        const stranger = makeEntity(otherScene);
        expect(() => registry.remove({ entity: stranger })).toThrow();
    });

    it("entity is no longer reachable by either RTID or EUID after removal", () => {
        const entity = makeEntity(scene);
        registry.remove({ entity });
        expect(registry.get({ entity_rtid: entity.rtid })).toBeNull();
        expect(registry.find({ entity_euid: entity.id })).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe("dirty tracking", () => {
    it("entity appears in update commands after a component mutation", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("debug_name");
    });

    it("dirty state is cleared after _flushDirtyEntities()", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(0);
    });

    it("returns empty commands when no entity is dirty", () => {
        makeEntity(scene);
        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });

    it("each distinct dirty entity appears exactly once", () => {
        const a = makeEntity(scene);
        const b = makeEntity(scene);
        a.debug_name = { value: "a" };
        b.debug_name = { value: "b" };

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(2);
    });

    it("mutating the same entity twice only produces one update command", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "first" };
        entity.debug_name = { value: "second" };

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(1);
    });

    it("deleted component appears in deleted_components of the update command", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        entity._clearDirtyState();

        entity.debug_name = undefined;

        const commands = registry._flushDirtyEntities();

        expect(commands[0].deleted_components).toContain("debug_name");
        expect(commands[0].dirty_components).not.toContain("debug_name");
    });
});

// ---------------------------------------------------------------------------

describe("broadcast accumulation", () => {
    it("entity appears in persist commands after an update flush", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();

        const commands = registry._flushPersistentEntities();

        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("debug_name");
    });

    it("persist list is empty before any update flush", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };

        // dirty but not yet flushed — persist list must still be empty
        expect(registry._flushPersistentEntities()).toHaveLength(0);
    });

    it("persist list is empty after _flushPersistentEntities consumes it", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();
        registry._flushPersistentEntities();

        expect(registry._flushPersistentEntities()).toHaveLength(0);
    });

    it("accumulates components across multiple update cycles into one persist command", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();

        entity.tags = { value: [] };
        registry._flushDirtyEntities();

        const commands = registry._flushPersistentEntities();
        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("debug_name");
        expect(commands[0].dirty_components).toContain("tags");
    });

    it("moves a component from unsaved to deleted when deleted after being dirtied", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();

        entity.debug_name = undefined;
        registry._flushDirtyEntities();

        const commands = registry._flushPersistentEntities();
        expect(commands[0].dirty_components).not.toContain("debug_name");
        expect(commands[0].deleted_components).toContain("debug_name");
    });

    it("moves a component from deleted back to unsaved when re-added after deletion", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "a" };
        registry._flushDirtyEntities();

        entity.debug_name = undefined;
        registry._flushDirtyEntities();

        entity.debug_name = { value: "b" };
        registry._flushDirtyEntities();

        const commands = registry._flushPersistentEntities();
        expect(commands[0].dirty_components).toContain("debug_name");
        expect(commands[0].deleted_components).not.toContain("debug_name");
    });

    it("removed entity does not appear in persist commands", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();

        registry.remove({ entity });

        expect(registry._flushPersistentEntities()).toHaveLength(0);
    });

    it("removed entity does not appear in update commands even if dirty at removal time", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        // dirty but not yet flushed — remove it before the update loop runs
        registry.remove({ entity });

        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });

    it("_removeAll clears dirty entities for the removed EUID", () => {
        const euid = crypto.randomUUID() as UUID;
        const [a, b] = makeLinkedEntities(scene, euid, [[crypto.randomUUID() as UUID], [crypto.randomUUID() as UUID]]);
        a.debug_name = { value: "a" };
        b.debug_name = { value: "b" };

        registry._removeAll({ entity_euid: euid });

        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });

    it("_removeAll clears persist entries for the removed EUID", () => {
        const euid = crypto.randomUUID() as UUID;
        const [a, b] = makeLinkedEntities(scene, euid, [[crypto.randomUUID() as UUID], [crypto.randomUUID() as UUID]]);
        a.debug_name = { value: "a" };
        b.debug_name = { value: "b" };
        registry._flushDirtyEntities();

        registry._removeAll({ entity_euid: euid });

        expect(registry._flushPersistentEntities()).toHaveLength(0);
    });
});

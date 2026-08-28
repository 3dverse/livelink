import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ComponentsManifest } from "@3dverse/livelink.core";

import { matchChannel } from "../sources/data/util/channel";
import { ExistingEntityResolver } from "../sources/data/resolvers/ExistingEntityResolver";
import { SpawningEntityResolver } from "../sources/data/resolvers/SpawningEntityResolver";
import { ComponentPatchApplier } from "../sources/data/apply/ComponentPatchApplier";
import { TransportRegistry } from "../sources/data/transports/TransportRegistry";
import type { IngestEvent } from "../sources/data/IngestEvent";

import { FakeEntity, FakeScene } from "./fakes";

//------------------------------------------------------------------------------
const ENTITY_UUID = "00000000-0000-0000-0000-0000000000e1";
const OTHER_ENTITY_UUID = "00000000-0000-0000-0000-0000000000e2";
const LINKAGE_UUID = "00000000-0000-0000-0000-00000000001a";
const OTHER_LINKAGE_UUID = "00000000-0000-0000-0000-00000000001b";

//------------------------------------------------------------------------------
function makeEvent(payload: unknown): IngestEvent {
    return { channel: "test", payload };
}

//------------------------------------------------------------------------------
beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

//------------------------------------------------------------------------------
describe("matchChannel", () => {
    it("matches exact, single-segment and multi-segment wildcards", () => {
        expect(matchChannel("file", "file")).toBe(true);
        expect(matchChannel("uagv/+/visualization", "uagv/23070/visualization")).toBe(true);
        expect(matchChannel("uagv/*/visualization", "uagv/23070/visualization")).toBe(true);
        expect(matchChannel("uagv/#", "uagv/23070/state")).toBe(true);
        expect(matchChannel("uagv/+/state", "uagv/23070/visualization")).toBe(false);
        expect(matchChannel("uagv/+", "uagv/23070/state")).toBe(false);
    });
});

//------------------------------------------------------------------------------
describe("ExistingEntityResolver — byUuid strategy", () => {
    it("resolves mapped ids and caches the lookup", async () => {
        const scene = new FakeScene();
        const entity = new FakeEntity();
        scene.existing.set(ENTITY_UUID, entity);

        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byUuid: { "servo-01": ENTITY_UUID } },
        });

        const first = await resolver.resolve({ id: "servo-01", event: makeEvent({}) });
        const second = await resolver.resolve({ id: "servo-01", event: makeEvent({}) });
        expect(first).toBe(entity.asEntity());
        expect(second).toBe(first);
        expect(scene.findEntity).toHaveBeenCalledTimes(1);
    });

    it("resolves unmapped ids to null with a single warning", async () => {
        const scene = new FakeScene();
        const resolver = new ExistingEntityResolver({ scene: scene.asScene(), lookup: { byUuid: {} } });

        expect(await resolver.resolve({ id: "ghost", event: makeEvent({}) })).toBeNull();
        expect(await resolver.resolve({ id: "ghost", event: makeEvent({}) })).toBeNull();
        expect(scene.findEntity).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("resolves an id naming an Object.prototype member to null, like any other unmapped id", async () => {
        // A mapping is free to take its ids straight from the payload's own keys, so `constructor`
        // is reachable input rather than a hypothetical one.
        const scene = new FakeScene();
        const resolver = new ExistingEntityResolver({ scene: scene.asScene(), lookup: { byUuid: {} } });

        expect(await resolver.resolve({ id: "constructor", event: makeEvent({}) })).toBeNull();
        expect(scene.findEntity).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("finds entities under the shared linkage, overridden per entry", async () => {
        const scene = new FakeScene();
        const entity = new FakeEntity();
        scene.existing.set(ENTITY_UUID, entity);
        scene.existing.set(OTHER_ENTITY_UUID, entity);

        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: {
                byUuid: {
                    "servo-01": ENTITY_UUID,
                    "servo-02": { entity_uuid: OTHER_ENTITY_UUID, linkage: [OTHER_LINKAGE_UUID] },
                },
                linkage: [LINKAGE_UUID],
            },
        });

        await resolver.resolve({ id: "servo-01", event: makeEvent({}) });
        await resolver.resolve({ id: "servo-02", event: makeEvent({}) });

        expect(scene.findEntity).toHaveBeenNthCalledWith(1, { entity_uuid: ENTITY_UUID, linkage: [LINKAGE_UUID] });
        expect(scene.findEntity).toHaveBeenNthCalledWith(2, {
            entity_uuid: OTHER_ENTITY_UUID,
            linkage: [OTHER_LINKAGE_UUID],
        });
    });

    it("defaults to an empty linkage", async () => {
        const scene = new FakeScene();
        scene.existing.set(ENTITY_UUID, new FakeEntity());

        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byUuid: { "servo-01": ENTITY_UUID } },
        });
        await resolver.resolve({ id: "servo-01", event: makeEvent({}) });

        expect(scene.findEntity).toHaveBeenCalledWith({ entity_uuid: ENTITY_UUID, linkage: [] });
    });

    it("caches entities missing from the scene as null", async () => {
        const scene = new FakeScene();
        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byUuid: { "servo-01": ENTITY_UUID } },
        });

        expect(await resolver.resolve({ id: "servo-01", event: makeEvent({}) })).toBeNull();
        expect(await resolver.resolve({ id: "servo-01", event: makeEvent({}) })).toBeNull();
        expect(scene.findEntity).toHaveBeenCalledTimes(1);
    });
});

//------------------------------------------------------------------------------
describe("ExistingEntityResolver — byName strategy", () => {
    it("resolves the entity carrying the name the id produces", async () => {
        const scene = new FakeScene();
        const blade = new FakeEntity();
        scene.named.set("part-blade", [blade]);

        const resolver = new ExistingEntityResolver({ scene: scene.asScene(), lookup: { byName: "part-{id}" } });

        expect(await resolver.resolve({ id: "blade", event: makeEvent({}) })).toBe(blade.asEntity());
        expect(scene.findEntitiesByNames).toHaveBeenCalledWith({ entity_names: ["part-blade"] });
    });

    it("accepts a function to derive the name", async () => {
        const scene = new FakeScene();
        const blade = new FakeEntity();
        scene.named.set("BLADE", [blade]);

        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byName: ({ id }) => id.toUpperCase() },
        });

        expect(await resolver.resolve({ id: "blade", event: makeEvent({}) })).toBe(blade.asEntity());
    });

    it("warns once and resolves null when no entity carries the name", async () => {
        const scene = new FakeScene();
        const resolver = new ExistingEntityResolver({ scene: scene.asScene(), lookup: { byName: "{id}" } });

        expect(await resolver.resolve({ id: "ghost", event: makeEvent({}) })).toBeNull();
        expect(await resolver.resolve({ id: "ghost", event: makeEvent({}) })).toBeNull();
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("warns about ambiguity but drives the first candidate", async () => {
        const scene = new FakeScene();
        const first = new FakeEntity();
        const second = new FakeEntity();
        scene.named.set("blade", [first, second]);

        const resolver = new ExistingEntityResolver({ scene: scene.asScene(), lookup: { byName: "{id}" } });

        expect(await resolver.resolve({ id: "blade", event: makeEvent({}) })).toBe(first.asEntity());
        expect(console.warn).toHaveBeenCalledTimes(1);
    });
});

//------------------------------------------------------------------------------
describe("ExistingEntityResolver — resolve strategy", () => {
    it("resolves through the supplied function, awaiting async ones", async () => {
        const scene = new FakeScene();
        const entity = new FakeEntity();
        scene.existing.set(ENTITY_UUID, entity);

        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { resolve: async ({ id }) => (id === "servo-01" ? ENTITY_UUID : null) },
        });

        expect(await resolver.resolve({ id: "servo-01", event: makeEvent({}) })).toBe(entity.asEntity());
        expect(await resolver.resolve({ id: "other", event: makeEvent({}) })).toBeNull();
    });
});

//------------------------------------------------------------------------------
describe("CachingEntityResolver cache invalidation", () => {
    it("retries a null resolution once an entity is created in the scene", async () => {
        const scene = new FakeScene();
        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byUuid: { "servo-01": ENTITY_UUID } },
        });

        expect(await resolver.resolve({ id: "servo-01", event: makeEvent({}) })).toBeNull();

        const entity = new FakeEntity({ id: ENTITY_UUID });
        scene.existing.set(ENTITY_UUID, entity);
        scene.emitEntitiesCreated([entity]);

        expect(await resolver.resolve({ id: "servo-01", event: makeEvent({}) })).toBe(entity.asEntity());
        expect(scene.findEntity).toHaveBeenCalledTimes(2);
    });

    it("keeps successful resolutions when unrelated entities are created", async () => {
        const scene = new FakeScene();
        const entity = new FakeEntity();
        scene.existing.set(ENTITY_UUID, entity);
        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byUuid: { "servo-01": ENTITY_UUID } },
        });

        await resolver.resolve({ id: "servo-01", event: makeEvent({}) });
        scene.emitEntitiesCreated([new FakeEntity()]);
        await resolver.resolve({ id: "servo-01", event: makeEvent({}) });

        expect(scene.findEntity).toHaveBeenCalledTimes(1);
    });

    it("drops a resolution when its entity is deleted", async () => {
        const scene = new FakeScene();
        const entity = new FakeEntity();
        scene.existing.set(ENTITY_UUID, entity);
        const resolver = new ExistingEntityResolver({
            scene: scene.asScene(),
            lookup: { byUuid: { "servo-01": ENTITY_UUID } },
        });

        await resolver.resolve({ id: "servo-01", event: makeEvent({}) });
        scene.emitEntitiesDeleted([entity]);
        await resolver.resolve({ id: "servo-01", event: makeEvent({}) });

        expect(scene.findEntity).toHaveBeenCalledTimes(2);
    });

    it("releases its scene listeners on dispose", async () => {
        const scene = new FakeScene();
        const resolver = new ExistingEntityResolver({ scene: scene.asScene(), lookup: { byUuid: {} } });
        expect(scene.listenerCount("on-entities-created")).toBe(1);
        expect(scene.listenerCount("on-entities-deleted")).toBe(1);

        resolver.dispose();

        expect(scene.listenerCount("on-entities-created")).toBe(0);
        expect(scene.listenerCount("on-entities-deleted")).toBe(0);
    });
});

//------------------------------------------------------------------------------
describe("SpawningEntityResolver", () => {
    it("spawns one entity per id, derived from the template and first event", async () => {
        const scene = new FakeScene();
        const resolver = new SpawningEntityResolver({
            scene: scene.asScene(),
            template: {
                name: "AGV-{id}",
                components: ({ event }): ComponentsManifest => ({
                    local_transform: { position: [(event.payload as { x: number }).x, 0, 0] },
                }),
                options: { delete_on_client_disconnection: true },
            },
        });

        const entity = await resolver.resolve({ id: "23070", event: makeEvent({ x: 4 }) });
        expect(entity).not.toBeNull();
        expect(scene.newEntity).toHaveBeenCalledWith({
            name: "AGV-23070",
            components: { local_transform: { position: [4, 0, 0] } },
            options: { delete_on_client_disconnection: true },
        });
    });

    it("dedups concurrent resolutions of the same id into one creation", async () => {
        const scene = new FakeScene();
        const resolver = new SpawningEntityResolver({
            scene: scene.asScene(),
            template: { name: "AGV-{id}", components: {} },
        });

        const [a, b] = await Promise.all([
            resolver.resolve({ id: "k", event: makeEvent({}) }),
            resolver.resolve({ id: "k", event: makeEvent({}) }),
        ]);
        expect(a).toBe(b);
        expect(scene.newEntity).toHaveBeenCalledTimes(1);
    });

    it("does not cache failed creations and retries on the next event", async () => {
        const scene = new FakeScene();
        scene.newEntity.mockRejectedValueOnce(new Error("boom"));
        const resolver = new SpawningEntityResolver({
            scene: scene.asScene(),
            template: { name: "AGV-{id}", components: {} },
        });

        expect(await resolver.resolve({ id: "k", event: makeEvent({}) })).toBeNull();
        expect(await resolver.resolve({ id: "k", event: makeEvent({}) })).not.toBeNull();
        expect(scene.newEntity).toHaveBeenCalledTimes(2);
    });
});

//------------------------------------------------------------------------------
describe("ComponentPatchApplier", () => {
    it("applies patches and skips writes deep-equal to the last applied patch", () => {
        const entity = new FakeEntity();
        const applier = new ComponentPatchApplier();

        expect(
            applier.apply({ entity: entity.asEntity(), updates: { local_transform: { position: [1, 2, 3] } } }),
        ).toEqual({
            written: 1,
            deduped: 0,
        });
        expect(entity.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });

        expect(
            applier.apply({ entity: entity.asEntity(), updates: { local_transform: { position: [1, 2, 3] } } }),
        ).toEqual({
            written: 0,
            deduped: 1,
        });
        expect(entity.updateComponent).toHaveBeenCalledTimes(1);

        applier.apply({ entity: entity.asEntity(), updates: { local_transform: { position: [9, 9, 9] } } });
        expect(entity.updateComponent).toHaveBeenCalledTimes(2);
    });

    it("tracks the last patch per component independently", () => {
        const entity = new FakeEntity();
        const applier = new ComponentPatchApplier();

        applier.apply({ entity: entity.asEntity(), updates: { local_transform: { position: [1, 2, 3] } } });
        applier.apply({ entity: entity.asEntity(), updates: { debug_name: { value: "a" } } });
        applier.apply({ entity: entity.asEntity(), updates: { local_transform: { position: [1, 2, 3] } } });
        expect(entity.updateComponent).toHaveBeenCalledTimes(2);
    });
});

//------------------------------------------------------------------------------
describe("TransportRegistry", () => {
    it("creates transports from registered factories and rejects unknown kinds", async () => {
        const registry = new TransportRegistry();
        const transport = { start: async (): Promise<void> => {}, stop: async (): Promise<void> => {} };
        registry.register({ kind: "custom", factory: () => transport });

        const sink = { ingest: (): void => {} };
        expect(await registry.create({ spec: { kind: "custom", config: {} }, sink })).toBe(transport);
        await expect(registry.create({ spec: { kind: "nope", config: {} }, sink })).rejects.toThrow(
            /Unknown transport kind/,
        );
        expect(() => registry.register({ kind: "custom", factory: () => transport })).toThrow(/already registered/);
    });
});

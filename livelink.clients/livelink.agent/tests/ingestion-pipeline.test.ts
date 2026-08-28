import { describe, it, expect, vi, beforeEach } from "vitest";

import { IngestionPipeline } from "../sources/data/IngestionPipeline";
import { continuous } from "../sources/data/EventMapping";
import type { EventMapping } from "../sources/data/EventMapping";
import type { IngestEvent } from "../sources/data/IngestEvent";

import { FakeEntity, FakeScene } from "./fakes";

//------------------------------------------------------------------------------
// Every test in this file drives mappings end to end with NO Agent and NO Transport: the pipeline
// is the whole data layer, and `ingest` is its entry point.
//------------------------------------------------------------------------------

const SERVO_UUID = "00000000-0000-0000-0000-0000000000e1";

const event = (channel: string, payload: unknown): IngestEvent => ({ channel, payload });

/** The id these tests carry at `payload.id` — undefined when the payload omits it, on purpose. */
const payloadId = (source: IngestEvent): string => (source.payload as { id: string }).id;

const positionMapping: EventMapping = {
    entities: { byUuid: { "dev-1": SERVO_UUID } },
    updates: source => ({
        id: payloadId(source),
        update: { local_transform: { position: (source.payload as { pos: [number, number, number] }).pos } },
    }),
};

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

//------------------------------------------------------------------------------
describe("IngestionPipeline construction", () => {
    it("requires at least one mapping", () => {
        expect(() => new IngestionPipeline({ mappings: [] })).toThrow(/at least one mapping/);
    });

    it("rejects a mapping whose `entities` declares no strategy, at construction and not at bind", () => {
        // The throw used to live in `bind()`, i.e. in a session-ready handler, far from the mistake.
        expect(
            () =>
                new IngestionPipeline({
                    mappings: { entities: {}, updates: () => null } as unknown as EventMapping,
                }),
        ).toThrow(/byName/);
    });

    it("rejects a mapping whose `updates` is not a function", () => {
        // Unreachable from TypeScript; this is what a JavaScript consumer gets instead.
        expect(
            () =>
                new IngestionPipeline({
                    mappings: {
                        entities: { byName: "{id}" },
                        updates: { id: "dev-1", update: {} },
                    } as unknown as EventMapping,
                }),
        ).toThrow(/must be a function/);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline event handling", () => {
    it("drives an existing entity in every bound scene, and dedups redundant writes", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });

        const sceneA = new FakeScene();
        const sceneB = new FakeScene();
        const servoA = new FakeEntity();
        const servoB = new FakeEntity();
        sceneA.existing.set(SERVO_UUID, servoA);
        sceneB.existing.set(SERVO_UUID, servoB);
        pipeline.bind({ scene: sceneA.asScene() });
        pipeline.bind({ scene: sceneB.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        expect(servoA.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
        expect(servoB.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });

        // The same value again is a no-op; a new value writes again.
        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        expect(servoA.updateComponent).toHaveBeenCalledTimes(1);
        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [4, 5, 6] }));
        expect(servoA.updateComponent).toHaveBeenCalledTimes(2);

        expect(pipeline.stats?.components_deduped).toBe(2);
    });

    it("spawns one entity per new id from the template", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { spawn: { name: "AGV-{id}", components: {} } },
                updates: source => ({
                    id: (source.payload as { serialNumber: string }).serialNumber,
                    update: {
                        local_transform: { position: (source.payload as { pos: [number, number, number] }).pos },
                    },
                }),
            },
        });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { serialNumber: "23070", pos: [1, 0, 0] }));
        await pipeline.ingest(event("mqtt", { serialNumber: "23070", pos: [2, 0, 0] }));
        await pipeline.ingest(event("mqtt", { serialNumber: "9999", pos: [3, 0, 0] }));

        expect(scene.spawned.map(s => s.name)).toEqual(["AGV-23070", "AGV-9999"]);
        expect(scene.spawned[0].entity.updateComponent).toHaveBeenCalledWith("local_transform", {
            position: [2, 0, 0],
        });
    });

    it("stops applying to a scene after it is unbound, and releases its scene listeners", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        const binding = pipeline.bind({ scene: scene.asScene() });
        expect(scene.listenerCount("on-entities-created")).toBe(1);

        binding.unbind();
        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));

        expect(servo.updateComponent).not.toHaveBeenCalled();
        expect(pipeline.boundSceneCount).toBe(0);
        expect(scene.listenerCount("on-entities-created")).toBe(0);
        expect(scene.listenerCount("on-entities-deleted")).toBe(0);
    });

    it("does not write to a scene unbound while its resolution was in flight", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        const binding = pipeline.bind({ scene: scene.asScene() });

        // The lookup only resolves once the session has already gone.
        let release = (): void => {};
        scene.findEntity.mockImplementationOnce(async () => {
            await new Promise<void>(resolve => {
                release = resolve;
            });
            return servo.asEntity();
        });

        const ingested = pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        binding.unbind();
        release();
        await ingested;

        expect(servo.updateComponent).not.toHaveBeenCalled();
    });

    it("ignores events whose updates() returns null, and reports updates() failures", async () => {
        const onError = vi.fn();
        const pipeline = new IngestionPipeline({
            onError,
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source => {
                    if ((source.payload as { bad?: boolean }).bad) {
                        throw new Error("updates failed");
                    }
                    return null;
                },
            },
        });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1" }));
        expect(servo.updateComponent).not.toHaveBeenCalled();

        await pipeline.ingest(event("mqtt", { id: "dev-1", bad: true }));
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "updates failed" }));
    });
});

//------------------------------------------------------------------------------
// Let every microtask already queued run. The apply path is several awaits deep — the scene-loaded
// wait, then the resolution, then the write — so a couple of `Promise.resolve()`s would stop short
// of it and pass an assertion that nothing happened for the wrong reason.
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe("IngestionPipeline scene loading", () => {
    it("resolves nothing until the scene reports its referenced scenes loaded", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);

        let release = (_loaded: boolean): void => {};
        scene.scene_loaded_gate = new Promise<boolean>(resolve => {
            release = resolve;
        });
        pipeline.bind({ scene: scene.asScene() });

        const ingested = pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        await flush();

        // An entity of a scene still streaming in must not be looked up at all: the resolver caches
        // its misses, and a miss here is only "not there yet".
        expect(scene.findEntity).not.toHaveBeenCalled();

        release(true);
        await ingested;

        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
    });

    it("goes ahead and counts the miss when the wait ends without the scene loaded", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        // `false` is what a disconnection mid-wait reports. Resolution still proceeds, finds
        // nothing, and says so through `drops` rather than swallowing the event.
        scene.scene_loaded_gate = Promise.resolve(false);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));

        expect(scene.findEntity).toHaveBeenCalled();
        expect(pipeline.stats?.drops.unresolved_entity).toBe(1);
    });

    it("waits on each bound scene separately", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const ready_scene = new FakeScene();
        const loading_scene = new FakeScene();
        const ready_servo = new FakeEntity();
        const loading_servo = new FakeEntity();
        ready_scene.existing.set(SERVO_UUID, ready_servo);
        loading_scene.existing.set(SERVO_UUID, loading_servo);

        let release = (_loaded: boolean): void => {};
        loading_scene.scene_loaded_gate = new Promise<boolean>(resolve => {
            release = resolve;
        });
        pipeline.bind({ scene: ready_scene.asScene() });
        pipeline.bind({ scene: loading_scene.asScene() });

        const ingested = pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        await flush();

        // One session still loading must not hold the others back.
        expect(ready_servo.updateComponent).toHaveBeenCalled();
        expect(loading_servo.updateComponent).not.toHaveBeenCalled();

        release(true);
        await ingested;
        expect(loading_servo.updateComponent).toHaveBeenCalled();
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline entity identity", () => {
    it("derives the id from a nested payload field", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source => ({
                    id: (source.payload as { header: { deviceId: string } }).header.deviceId,
                    update: { debug_name: { value: "hit" } },
                }),
            },
        });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { header: { deviceId: "dev-1" } }));
        expect(servo.updateComponent).toHaveBeenCalledWith("debug_name", { value: "hit" });
    });

    it("derives the id from the channel, so a payload need not repeat its own id", async () => {
        // The VDA 5050 case: the serial number lives in the topic, not in the payload.
        const pipeline = new IngestionPipeline({
            mappings: {
                channel: "uagv/+/+/+/visualization",
                entities: { spawn: { name: "AGV-{id}", components: {} } },
                updates: source => ({
                    id: source.channel.split("/")[3],
                    update: {
                        local_transform: { position: (source.payload as { pos: [number, number, number] }).pos },
                    },
                }),
            },
        });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("uagv/v2/dsautomotion/23070-1100/visualization", { pos: [1, 2, 3] }));

        expect(scene.spawned.map(s => s.name)).toEqual(["AGV-23070-1100"]);
        expect(scene.spawned[0].entity.updateComponent).toHaveBeenCalledWith("local_transform", {
            position: [1, 2, 3],
        });
    });

    it("drops an update carrying no usable id, and counts it", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        pipeline.bind({ scene: new FakeScene().asScene() });

        await pipeline.ingest(event("mqtt", { pos: [1, 2, 3] }));

        expect(pipeline.stats?.drops.no_id).toBe(1);
        expect(pipeline.stats?.events_dropped).toBe(1);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline multi-entity events", () => {
    it("drives several entities from ONE whole-state frame", async () => {
        // The industrial-machine case: one message carries the state of every moving part, so
        // `updates` returns an array instead of a single entry.
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byName: "{id}" },
                updates: ({ payload }) => {
                    const { angle, posZ } = payload as { angle: number; posZ: number };
                    return [
                        { id: "blade", update: { local_transform: { eulerOrientation: [0, angle, 0] } } },
                        { id: "carriage", update: { local_transform: { position: [0, posZ, 0] } } },
                    ];
                },
            },
        });

        const scene = new FakeScene();
        const blade = new FakeEntity();
        const carriage = new FakeEntity();
        scene.named.set("blade", [blade]);
        scene.named.set("carriage", [carriage]);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("part-0", { angle: 42, posZ: -0.5 }));

        expect(blade.updateComponent).toHaveBeenCalledWith("local_transform", { eulerOrientation: [0, 42, 0] });
        expect(carriage.updateComponent).toHaveBeenCalledWith("local_transform", { position: [0, -0.5, 0] });
        expect(pipeline.stats?.updates_applied).toBe(2);
    });

    it("ignores an event whose updates() returns null", async () => {
        const pipeline = new IngestionPipeline({
            mappings: { entities: { byName: "{id}" }, updates: () => null },
        });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("part-0", {}));
        expect(pipeline.stats?.drops.no_updates).toBe(1);
    });

    it("drops only the entries with no usable id, counting each once however many scenes are bound", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byName: "{id}" },
                updates: () => [
                    { id: "blade", update: { debug_name: { value: "hit" } } },
                    { id: undefined as unknown as string, update: { debug_name: { value: "nope" } } },
                ],
            },
        });
        const sceneA = new FakeScene();
        const sceneB = new FakeScene();
        const bladeA = new FakeEntity();
        const bladeB = new FakeEntity();
        sceneA.named.set("blade", [bladeA]);
        sceneB.named.set("blade", [bladeB]);
        pipeline.bind({ scene: sceneA.asScene() });
        pipeline.bind({ scene: sceneB.asScene() });

        await pipeline.ingest(event("part-0", {}));

        // The good entry still reaches both scenes, and the bad one is counted once — not once per
        // bound scene, which is why the check lives in the per-event step.
        expect(bladeA.updateComponent).toHaveBeenCalledWith("debug_name", { value: "hit" });
        expect(bladeB.updateComponent).toHaveBeenCalledWith("debug_name", { value: "hit" });
        expect(pipeline.stats?.drops.no_id).toBe(1);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline existing-entity strategies", () => {
    it("resolves by name, so no UUID has to be configured", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byName: "part-{id}" },
                updates: source => ({ id: payloadId(source), update: { debug_name: { value: "hit" } } }),
            },
        });
        const scene = new FakeScene();
        const blade = new FakeEntity();
        scene.named.set("part-blade", [blade]);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("eh", { id: "blade" }));
        expect(blade.updateComponent).toHaveBeenCalledWith("debug_name", { value: "hit" });
    });

    it("keeps only the named candidates sitting under the configured linkage", async () => {
        const SUB_SCENE = "00000000-0000-0000-0000-00000000f001";
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byName: "{id}", linkage: [SUB_SCENE] },
                updates: source => ({ id: payloadId(source), update: { debug_name: { value: "hit" } } }),
            },
        });
        const scene = new FakeScene();
        const at_root = new FakeEntity();
        const in_sub_scene = new FakeEntity({ lineage: [SUB_SCENE] });
        scene.named.set("blade", [at_root, in_sub_scene]);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("eh", { id: "blade" }));

        expect(in_sub_scene.updateComponent).toHaveBeenCalled();
        expect(at_root.updateComponent).not.toHaveBeenCalled();
    });

    it("resolves through a custom function", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { resolve: ({ id }) => (id === "dev-1" ? SERVO_UUID : null) },
                updates: source => ({ id: payloadId(source), update: { debug_name: { value: "hit" } } }),
            },
        });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("eh", { id: "dev-1" }));
        expect(servo.updateComponent).toHaveBeenCalled();

        await pipeline.ingest(event("eh", { id: "unknown" }));
        expect(pipeline.stats?.drops.unresolved_entity).toBe(1);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline resolution cache", () => {
    it("looks an unresolvable id up once", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [4, 5, 6] }));
        expect(scene.findEntity).toHaveBeenCalledTimes(1);
    });

    it("retries an unresolved id by itself once the entity appears in the scene", async () => {
        // A stream may mention an id before the scene has the entity: the scene says when to retry,
        // so no caller has to invalidate anything by hand.
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        expect(scene.findEntity).toHaveBeenCalledTimes(1);

        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        scene.emitEntitiesCreated([servo]);

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [7, 8, 9] }));
        expect(scene.findEntity).toHaveBeenCalledTimes(2);
        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { position: [7, 8, 9] });
    });

    it("drops the resolution of an entity deleted by someone else", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        expect(scene.findEntity).toHaveBeenCalledTimes(1);

        scene.existing.delete(SERVO_UUID);
        scene.emitEntitiesDeleted([servo]);

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [4, 5, 6] }));
        expect(scene.findEntity).toHaveBeenCalledTimes(2);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline auto_broadcast management", () => {
    it("forces auto_broadcast off on the first resolution, for both an existing and a spawned entity", async () => {
        const pipeline = new IngestionPipeline({
            mappings: [
                positionMapping,
                {
                    entities: { spawn: { name: "AGV-{id}", components: {} } },
                    updates: source => ({ id: payloadId(source), update: { debug_name: { value: "x" } } }),
                },
            ],
        });
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        await pipeline.ingest(event("mqtt", { id: "agv-1" }));

        expect(servo.auto_broadcast).toBe(false);
        expect(scene.spawned[0].entity.auto_broadcast).toBe(false);
    });

    it("leaves auto_broadcast untouched when manage_auto_broadcast is false", async () => {
        const pipeline = new IngestionPipeline({
            mappings: [
                positionMapping,
                {
                    entities: { spawn: { name: "AGV-{id}", components: {} } },
                    updates: source => ({ id: payloadId(source), update: { debug_name: { value: "x" } } }),
                },
            ],
            manage_auto_broadcast: false,
        });
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        await pipeline.ingest(event("mqtt", { id: "agv-1" }));

        expect(servo.auto_broadcast).toBe(true);
        expect(scene.spawned[0].entity.auto_broadcast).toBe(true);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline entity directives", () => {
    it("deletes the addressed entity, and respawns it on a later event", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { spawn: { name: "AGV-{id}", components: {} } },
                updates: source => ({
                    id: payloadId(source),
                    update: (source.payload as { gone?: boolean }).gone ? "delete" : { debug_name: { value: "x" } },
                }),
            },
        });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "agv-1" }));
        expect(scene.spawned).toHaveLength(1);

        await pipeline.ingest(event("mqtt", { id: "agv-1", gone: true }));
        expect(scene.deleted).toHaveLength(1);
        expect(pipeline.stats?.directives_applied).toBe(1);

        // The scene announces nothing for a deletion this client performed, so the pipeline drops
        // the resolution itself — otherwise the id would stay bound to a dead entity forever.
        await pipeline.ingest(event("mqtt", { id: "agv-1" }));
        expect(scene.spawned).toHaveLength(2);
    });

    it("reports a returned string that is not a directive, instead of counting it applied", async () => {
        const onError = vi.fn();
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source => ({ id: payloadId(source), update: "remove" as unknown as "delete" }),
            },
            onError,
        });
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1" }));

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("remove") }));
        expect(scene.deleted).toHaveLength(0);
        expect(pipeline.stats?.directives_applied).toBe(0);
        expect(pipeline.stats?.updates_applied).toBe(0);
    });

    it("hides and shows the addressed entity", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source => ({
                    id: payloadId(source),
                    update: (source.payload as { visible: boolean }).visible ? "show" : "hide",
                }),
            },
        });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", visible: false }));
        expect(servo.is_visible).toBe(false);

        await pipeline.ingest(event("mqtt", { id: "dev-1", visible: true }));
        expect(servo.is_visible).toBe(true);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline mapping selection", () => {
    it("routes events to mappings by channel pattern and payload predicate", async () => {
        const POSE_UUID = "00000000-0000-0000-0000-0000000000aa";
        const STATUS_UUID = "00000000-0000-0000-0000-0000000000bb";
        const pipeline = new IngestionPipeline({
            mappings: [
                {
                    channel: "uagv/+/visualization",
                    entities: { byUuid: { "dev-1": POSE_UUID } },
                    updates: source => ({
                        id: payloadId(source),
                        update: {
                            local_transform: { position: (source.payload as { pos: [number, number, number] }).pos },
                        },
                    }),
                },
                {
                    when: source => (source.payload as { status?: unknown }).status !== undefined,
                    entities: { byUuid: { "dev-1": STATUS_UUID } },
                    updates: source => ({
                        id: payloadId(source),
                        update: { debug_name: { value: (source.payload as { status: string }).status } },
                    }),
                },
            ],
        });

        const scene = new FakeScene();
        const pose = new FakeEntity();
        const status = new FakeEntity();
        scene.existing.set(POSE_UUID, pose);
        scene.existing.set(STATUS_UUID, status);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("uagv/dev-1/visualization", { id: "dev-1", pos: [1, 2, 3] }));
        expect(pose.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
        expect(status.updateComponent).not.toHaveBeenCalled();

        await pipeline.ingest(event("uagv/dev-1/state", { id: "dev-1", status: "RUNNING" }));
        expect(status.updateComponent).toHaveBeenCalledWith("debug_name", { value: "RUNNING" });
        expect(pose.updateComponent).toHaveBeenCalledTimes(1);
    });

    it("counts an event no mapping wanted, instead of losing it silently", async () => {
        const pipeline = new IngestionPipeline({ mappings: { ...positionMapping, channel: "wanted/#" } });
        pipeline.bind({ scene: new FakeScene().asScene() });

        await pipeline.ingest(event("unwanted/topic", { id: "dev-1", pos: [1, 2, 3] }));

        expect(pipeline.stats?.drops.no_mapping_matched).toBe(1);
        expect(pipeline.stats?.events_matched).toBe(0);
    });

    it("counts events arriving with no scene bound", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));

        expect(pipeline.stats?.drops.no_binding).toBe(1);
        expect(pipeline.stats?.events_received).toBe(1);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline schema validation", () => {
    const schema = {
        type: "object",
        properties: { id: { type: "string" }, pos: { type: "array" } },
        required: ["id", "pos"],
    };

    it("validates only the FIRST matching event by default", async () => {
        const pipeline = new IngestionPipeline({ mappings: { ...positionMapping, schema } });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        // First event invalid → dropped with a warning.
        await pipeline.ingest(event("mqtt", { id: "dev-1" }));
        expect(servo.updateComponent).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(pipeline.stats?.drops.schema).toBe(1);

        // Subsequent events are NOT validated any more (first-event check only)...
        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        expect(servo.updateComponent).toHaveBeenCalledTimes(1);
    });

    it("validates every event when `validate: true`", async () => {
        const pipeline = new IngestionPipeline({ mappings: { ...positionMapping, schema }, validate: true });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));
        expect(servo.updateComponent).toHaveBeenCalledTimes(1);

        // An invalid event is dropped even after valid ones.
        await pipeline.ingest(event("mqtt", { id: "dev-1" }));
        expect(servo.updateComponent).toHaveBeenCalledTimes(1);
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline stats", () => {
    it("reports what flowed, per mapping", async () => {
        const pipeline = new IngestionPipeline({ mappings: { ...positionMapping, channel: "mqtt" } });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));

        const stats = pipeline.stats!;
        expect(stats.events_received).toBe(1);
        expect(stats.events_matched).toBe(1);
        expect(stats.updates_applied).toBe(1);
        expect(stats.components_written).toBe(1);
        expect(stats.bound_scene_count).toBe(1);
        expect(stats.last_event_at).toBeInstanceOf(Date);
        expect(stats.per_mapping[0]).toMatchObject({
            index: 0,
            channel: "mqtt",
            events_matched: 1,
            updates_applied: 1,
        });
    });

    it("reports null, not zeros, when counting is turned off", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping, stats: false });
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "dev-1", pos: [1, 2, 3] }));

        // The ingestion itself is unaffected — only the counting is gone.
        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { position: [1, 2, 3] });
        expect(pipeline.stats).toBeNull();
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline retry scope", () => {
    it("does not re-look-up an unresolved name when an unrelated entity is spawned", async () => {
        // A spawning mapping feeding the same scene must not cost one round trip per unresolved id
        // per spawn: only an entity that could actually satisfy the name is worth retrying for.
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byName: "Servo-{id}" },
                updates: source => ({ id: payloadId(source), update: { debug_name: { value: "hit" } } }),
            },
        });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { id: "1" }));
        expect(scene.findEntitiesByNames).toHaveBeenCalledTimes(1);

        scene.emitEntitiesCreated([new FakeEntity({ name: "AGV-42" })]);
        await pipeline.ingest(event("mqtt", { id: "1" }));
        expect(scene.findEntitiesByNames).toHaveBeenCalledTimes(1);

        // ...but the entity it was actually waiting for does trigger the retry.
        const servo = new FakeEntity({ name: "Servo-1" });
        scene.named.set("Servo-1", [servo]);
        scene.emitEntitiesCreated([servo]);

        await pipeline.ingest(event("mqtt", { id: "1" }));
        expect(scene.findEntitiesByNames).toHaveBeenCalledTimes(2);
        expect(servo.updateComponent).toHaveBeenCalledWith("debug_name", { value: "hit" });
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline continuous updates", () => {
    /** Spins at `rpm`, reading its angle straight off the time since the event that set it. */
    const spinMapping = (rpm_of: (source: IngestEvent) => number): EventMapping => ({
        entities: { byUuid: { "dev-1": SERVO_UUID } },
        updates: source => {
            const rpm = rpm_of(source);
            return {
                id: "dev-1",
                update: continuous(({ since_seconds }) => ({
                    local_transform: { eulerOrientation: [rpm * 6 * since_seconds, 0, 0] },
                })),
            };
        },
    });

    const bindOne = (pipeline: IngestionPipeline): FakeEntity => {
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });
        return servo;
    };

    it("writes on the installing event, before any tick", async () => {
        const pipeline = new IngestionPipeline({ mappings: spinMapping(() => 60) });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));

        // since_seconds is 0 on the installing event, so the entity starts where it is.
        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { eulerOrientation: [0, 0, 0] });
        expect(pipeline.stats?.continuations_active).toBe(1);
    });

    it("keeps producing values on each tick, long after the event that set the rate", async () => {
        const pipeline = new IngestionPipeline({ mappings: spinMapping(() => 60) });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));

        // The ticks are the only clock: no timers to fake, and the same ticks always replay the
        // same motion. 60 rpm is 360 deg/s, so half a second in it is a half turn round.
        await pipeline.tick(0.25);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [90, 0, 0] });

        await pipeline.tick(0.25);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [180, 0, 0] });
    });

    it("samples the continuation once however many scenes are bound", async () => {
        // The regression this design exists to prevent: sampling per binding would advance a
        // stateful closure once per session, and a shaft would turn N times too fast.
        let samples = 0;
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: () => ({
                    id: "dev-1",
                    update: continuous(() => {
                        samples++;
                        return { local_transform: { position: [samples, 0, 0] } };
                    }),
                }),
            },
        });
        const servoA = bindOne(pipeline);
        const servoB = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(0.1);

        expect(samples).toBe(2); // once on the event, once on the tick — not once per scene.
        // Both scenes therefore see the same value, rather than drifting apart.
        expect(servoA.updateComponent).toHaveBeenLastCalledWith("local_transform", { position: [2, 0, 0] });
        expect(servoB.updateComponent).toHaveBeenLastCalledWith("local_transform", { position: [2, 0, 0] });
    });

    it("replaces the continuation when a newer event arrives for the same id", async () => {
        const pipeline = new IngestionPipeline({
            mappings: spinMapping(source => (source.payload as { rpm: number }).rpm),
        });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", { rpm: 60 }));
        await pipeline.ingest(event("mqtt", { rpm: 0 }));
        await pipeline.tick(1);

        // The second event took over: at 0 rpm nothing turns any more.
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [0, 0, 0] });
        expect(pipeline.stats?.continuations_active).toBe(1);
    });

    it("forgets a continuation that reports it is done, and one whose entity is deleted", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source =>
                    (source.payload as { stop?: boolean }).stop === true
                        ? { id: "dev-1", update: continuous(() => null) }
                        : { id: "dev-1", update: continuous(() => ({ local_transform: { position: [1, 0, 0] } })) },
            },
        });
        bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));
        expect(pipeline.stats?.continuations_active).toBe(1);

        await pipeline.ingest(event("mqtt", { stop: true }));
        expect(pipeline.stats?.continuations_active).toBe(0);
    });

    it("does not count ticks as events, so the stream's own numbers keep their meaning", async () => {
        const pipeline = new IngestionPipeline({ mappings: spinMapping(() => 60) });
        bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));
        const after_event = pipeline.stats;

        await pipeline.tick(0.1);
        await pipeline.tick(0.1);
        const after_ticks = pipeline.stats;

        expect(after_ticks?.events_received).toBe(after_event?.events_received);
        expect(after_ticks?.last_event_at).toEqual(after_event?.last_event_at);
        expect(after_ticks?.ticks_processed).toBe(2);
        // The writes the clock produced are still counted as writes, because they are.
        expect(after_ticks?.components_written).toBeGreaterThan(after_event?.components_written ?? 0);
    });

    it("is a no-op when nothing is installed, or nothing is bound", async () => {
        const pipeline = new IngestionPipeline({ mappings: positionMapping });
        const servo = bindOne(pipeline);

        await pipeline.tick(0.1);
        expect(servo.updateComponent).not.toHaveBeenCalled();

        const unbound = new IngestionPipeline({ mappings: spinMapping(() => 60) });
        await expect(unbound.tick(0.1)).resolves.toBeUndefined();
    });

    it("drops a continuation that throws rather than reporting it on every tick", async () => {
        const onError = vi.fn();
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: () => ({
                    id: "dev-1",
                    update: continuous(({ since_seconds }) => {
                        if (since_seconds > 0) {
                            throw new Error("boom");
                        }
                        return { local_transform: { position: [0, 0, 0] } };
                    }),
                }),
            },
            onError,
        });
        bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(0.1);
        await pipeline.tick(0.1);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(pipeline.stats?.continuations_active).toBe(0);
    });

    it("leaves a running motion alone when an event says nothing about its entity", async () => {
        // One topic, payloads of several shapes: a message with no rate is not a message saying
        // "stop". `updates` returning null means this event had nothing to say about this entity, so
        // the shaft keeps turning at the rate the last message that *did* mention it set.
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source => {
                    const { rpm } = source.payload as { rpm?: number };
                    if (rpm === undefined) {
                        return null;
                    }
                    return {
                        id: "dev-1",
                        update: continuous<{ angle_deg: number }>(
                            ({ delta_seconds, state }) => {
                                state.angle_deg += rpm * 6 * delta_seconds;
                                return { local_transform: { eulerOrientation: [state.angle_deg, 0, 0] } };
                            },
                            { initial_state: { angle_deg: 0 } },
                        ),
                    };
                },
            },
        });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", { rpm: 60 }));
        await pipeline.tick(0.5);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [180, 0, 0] });

        // A humidity reading on the same topic. It matches the mapping and produces nothing.
        await pipeline.ingest(event("mqtt", { humidity: 41 }));
        expect(pipeline.stats?.continuations_active).toBe(1);

        // Still turning, and at the same rate — the motion was neither stopped nor rebased.
        await pipeline.tick(0.5);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [360, 0, 0] });
    });

    it("carries the entity's state across the event that replaces the motion", async () => {
        // The reason `state` is the pipeline's and not the mapping's: a new rpm must pick the shaft
        // up where it stands, and integrating with `delta_seconds` cannot run away as re-reading
        // `since_seconds` would.
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source => ({
                    id: "dev-1",
                    update: continuous<{ angle_deg: number }>(
                        ({ delta_seconds, state }) => {
                            state.angle_deg += (source.payload as { rpm: number }).rpm * 6 * delta_seconds;
                            return { local_transform: { eulerOrientation: [state.angle_deg, 0, 0] } };
                        },
                        { initial_state: { angle_deg: 0 } },
                    ),
                }),
            },
        });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", { rpm: 60 })); // 360 deg/s
        await pipeline.tick(0.5);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [180, 0, 0] });

        // A second event installs a fresh continuation — and a fresh `initial_state`, which must NOT
        // snap the shaft back to zero.
        await pipeline.ingest(event("mqtt", { rpm: 30 })); // 180 deg/s
        await pipeline.tick(0.5);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [270, 0, 0] });
    });

    it("drops the state with the entity, so an id that comes back starts clean", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source =>
                    (source.payload as { gone?: boolean }).gone === true
                        ? { id: "dev-1", update: "delete" }
                        : {
                              id: "dev-1",
                              update: continuous<{ ticks: number }>(
                                  ({ state }) => {
                                      state.ticks++;
                                      return { local_transform: { position: [state.ticks, 0, 0] } };
                                  },
                                  { initial_state: { ticks: 0 } },
                              ),
                          },
            },
        });
        const scene = new FakeScene();
        const servo = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(0.1);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { position: [2, 0, 0] });

        await pipeline.ingest(event("mqtt", { gone: true }));
        expect(pipeline.stats?.continuations_active).toBe(0);

        // The id comes back — a device rejoining the fleet — and its counter restarts from scratch
        // rather than resuming at 3: the state went with the entity.
        const servo_again = new FakeEntity();
        scene.existing.set(SERVO_UUID, servo_again);
        await pipeline.ingest(event("mqtt", {}));
        expect(servo_again.updateComponent).toHaveBeenLastCalledWith("local_transform", { position: [1, 0, 0] });
    });

    it("can end a motion with a whole-entity directive", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: () => ({
                    id: "dev-1",
                    update: continuous(({ since_seconds }) =>
                        since_seconds > 0.5 ? "hide" : { local_transform: { position: [since_seconds, 0, 0] } },
                    ),
                }),
            },
        });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(1);

        expect(servo.is_visible).toBe(false);
    });

    it("refuses a bare function, which is a patch-shaped slip and not a motion", async () => {
        const onError = vi.fn();
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                // Exactly what `continuous()` exists to prevent: well-typed as a function, and
                // meant as "build me a patch" rather than "keep moving".
                updates: () => ({ id: "dev-1", update: (() => ({ debug_name: { value: "x" } })) as never }),
            },
            onError,
        });
        const servo = bindOne(pipeline);

        await pipeline.ingest(event("mqtt", {}));

        expect(servo.updateComponent).not.toHaveBeenCalled();
        expect(pipeline.stats?.continuations_active).toBe(0);
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("continuous(") }),
        );
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline continuation lifecycle", () => {
    /** Spins at `rpm`, reading its angle straight off the time since the event that set it. */
    const spinMapping: EventMapping = {
        entities: { byUuid: { "dev-1": SERVO_UUID } },
        updates: () => ({
            id: "dev-1",
            update: continuous(({ since_seconds }) => ({
                local_transform: { eulerOrientation: [360 * since_seconds, 0, 0] },
            })),
        }),
    };

    it("keeps a motion running when one of the bound scenes cannot resolve its entity", async () => {
        // The continuation map is shared by every binding, so a miss in one scene must not stop the
        // motion in the others — with `mode: "join-all"`, one session lacking the entity would
        // otherwise freeze every session that has it.
        const pipeline = new IngestionPipeline({ mappings: spinMapping });
        const withEntity = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        withEntity.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: withEntity.asScene() });
        pipeline.bind({ scene: new FakeScene().asScene() });

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(0.25);

        expect(pipeline.stats?.continuations_active).toBe(1);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [90, 0, 0] });

        await pipeline.tick(0.25);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [180, 0, 0] });
    });

    it("starts moving by itself once the entity appears, with no further event", async () => {
        // A machine that reports a rate may say nothing for minutes, so waiting for the next event
        // to reinstall the motion is not a recovery — the scene stays frozen until then.
        const pipeline = new IngestionPipeline({ mappings: spinMapping });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));
        expect(pipeline.stats?.continuations_active).toBe(1);
        await pipeline.tick(0.25);

        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        scene.emitEntitiesCreated([servo]);

        await pipeline.tick(0.25);
        expect(servo.updateComponent).toHaveBeenCalledWith("local_transform", { eulerOrientation: [180, 0, 0] });
    });

    it("does not count a tick that resolves nothing as a dropped event", async () => {
        // `drops` answers "what became of the stream". One motion running against a scene with no
        // such entity would otherwise post thirty drops a second and drown every real number in it.
        const pipeline = new IngestionPipeline({ mappings: spinMapping });
        pipeline.bind({ scene: new FakeScene().asScene() });

        await pipeline.ingest(event("mqtt", {}));
        expect(pipeline.stats?.drops.unresolved_entity).toBe(1);

        await pipeline.tick(0.1);
        await pipeline.tick(0.1);
        expect(pipeline.stats?.drops.unresolved_entity).toBe(1);
    });

    it("stops the motion when the entity is hidden, and resumes it where it stopped", async () => {
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: source =>
                    (source.payload as { hidden?: boolean }).hidden === true
                        ? { id: "dev-1", update: "hide" }
                        : {
                              id: "dev-1",
                              update: continuous<{ angle_deg: number }>(
                                  ({ delta_seconds, state }) => {
                                      state.angle_deg += 360 * delta_seconds;
                                      return { local_transform: { eulerOrientation: [state.angle_deg, 0, 0] } };
                                  },
                                  { initial_state: { angle_deg: 0 } },
                              ),
                          },
            },
        });
        const scene = new FakeScene();
        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(0.5);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [180, 0, 0] });

        // Nothing anyone can see is moving: the entity should stop taking writes altogether.
        await pipeline.ingest(event("mqtt", { hidden: true }));
        expect(pipeline.stats?.continuations_active).toBe(0);
        const writes = servo.updateComponent.mock.calls.length;
        await pipeline.tick(0.5);
        expect(servo.updateComponent.mock.calls.length).toBe(writes);

        // Unlike "delete", "hide" keeps the entity's state, so the shaft picks up at 180 — not 0.
        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(0.5);
        expect(servo.updateComponent).toHaveBeenLastCalledWith("local_transform", { eulerOrientation: [360, 0, 0] });
    });

    it("stops installed motions on demand, one id's or all of them", async () => {
        // Nothing expires a continuation on its own, so this is the switch an operator reaches for
        // when a stream is known bad and the scene should stop pretending otherwise.
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byName: "{id}" },
                updates: () => [
                    { id: "blade", update: continuous(() => ({ debug_name: { value: "blade" } })) },
                    { id: "carriage", update: continuous(() => ({ debug_name: { value: "carriage" } })) },
                ],
            },
        });
        const scene = new FakeScene();
        scene.named.set("blade", [new FakeEntity({ name: "blade" })]);
        scene.named.set("carriage", [new FakeEntity({ name: "carriage" })]);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));
        expect(pipeline.stats?.continuations_active).toBe(2);

        pipeline.clearContinuations({ id: "blade" });
        expect(pipeline.stats?.continuations_active).toBe(1);

        pipeline.clearContinuations();
        await pipeline.tick(1);
        expect(pipeline.stats?.continuations_active).toBe(0);
    });

    it("keeps a motion running however long nothing refreshes it, and says nothing about it", async () => {
        const pipeline = new IngestionPipeline({ mappings: spinMapping });
        const scene = new FakeScene();
        scene.existing.set(SERVO_UUID, new FakeEntity({ id: SERVO_UUID }));
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));
        await pipeline.tick(61);
        await pipeline.tick(61);

        // Until replaced means until replaced. The pipeline holds no opinion about how long that is:
        // "nothing has replaced this motion" is not "the stream is dead", so guessing at the second
        // from the first would stop live machines and warn about healthy ones.
        expect(pipeline.stats?.continuations_active).toBe(1);
        expect(console.warn).not.toHaveBeenCalled();
    });
});

//------------------------------------------------------------------------------
describe("IngestionPipeline continuation observability and retention", () => {
    it("breaks the continuation gauge down per mapping", async () => {
        // The global gauge answers "is anything moving?"; with more than one mapping in play, the
        // question is which one — and which one a stream going quiet has left running.
        const spinning = (channel: string): EventMapping => ({
            channel,
            entities: { byName: "{id}" },
            updates: () => ({ id: channel, update: continuous(() => ({ debug_name: { value: channel } })) }),
        });
        const pipeline = new IngestionPipeline({ mappings: [spinning("blade"), spinning("carriage")] });
        const scene = new FakeScene();
        scene.named.set("blade", [new FakeEntity({ name: "blade" })]);
        scene.named.set("carriage", [new FakeEntity({ name: "carriage" })]);
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("blade", {}));
        expect(pipeline.stats?.per_mapping.map(mapping => mapping.continuations_active)).toEqual([1, 0]);

        await pipeline.ingest(event("carriage", {}));
        expect(pipeline.stats?.per_mapping.map(mapping => mapping.continuations_active)).toEqual([1, 1]);
        expect(pipeline.stats?.continuations_active).toBe(2);

        pipeline.clearContinuations({ id: "blade" });
        expect(pipeline.stats?.per_mapping.map(mapping => mapping.continuations_active)).toEqual([0, 1]);
    });

    it("records a drop reason when every update self-cancels on its first sample", async () => {
        // Without this, an event whose only entries were motions already over is the one way to
        // reach `events_dropped` with nothing in `drops` — which during bring-up reads as the
        // pipeline losing the event rather than the mapping declining it.
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { byUuid: { "dev-1": SERVO_UUID } },
                updates: () => ({ id: "dev-1", update: continuous(() => null) }),
            },
        });
        const scene = new FakeScene();
        scene.existing.set(SERVO_UUID, new FakeEntity({ id: SERVO_UUID }));
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));

        expect(pipeline.stats?.events_dropped).toBe(1);
        expect(pipeline.stats?.drops.no_updates).toBe(1);
        expect(pipeline.stats?.per_mapping[0].drops.no_updates).toBe(1);
        expect(pipeline.stats?.continuations_active).toBe(0);
    });

    it("does not resolve an entity again on every tick", async () => {
        // A tick drives an id an event already resolved, so it reads the resolver's cache instead of
        // going back through the consumer's own `resolve` — thirty times a second, per entity.
        const resolve = vi.fn(() => SERVO_UUID);
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { resolve },
                updates: () => ({ id: "dev-1", update: continuous(() => ({ debug_name: { value: "on" } })) }),
            },
        });
        const scene = new FakeScene();
        scene.existing.set(SERVO_UUID, new FakeEntity({ id: SERVO_UUID }));
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", {}));
        for (let tick = 0; tick < 10; tick++) {
            await pipeline.tick(0.1);
        }

        expect(resolve).toHaveBeenCalledTimes(1);
        expect(scene.findEntity).toHaveBeenCalledTimes(1);
    });

    it("resolves a tick-time fallback against the event that installed the motion", async () => {
        // The one case a tick still has to resolve: an id whose entity was not in the scene yet.
        // `resolve` is a function of the event, so the continuation kept the real one — deliberately
        // stale, since it is the message that said which entity this motion is about.
        const resolve = vi.fn(({ event: source }: { event: IngestEvent }) => (source.payload as { uuid: string }).uuid);
        const pipeline = new IngestionPipeline({
            mappings: {
                entities: { resolve },
                updates: () => ({ id: "dev-1", update: continuous(() => ({ debug_name: { value: "on" } })) }),
            },
        });
        const scene = new FakeScene();
        pipeline.bind({ scene: scene.asScene() });

        await pipeline.ingest(event("mqtt", { uuid: SERVO_UUID }));
        expect(resolve).toHaveBeenCalledTimes(1);

        const servo = new FakeEntity({ id: SERVO_UUID });
        scene.existing.set(SERVO_UUID, servo);
        scene.emitEntitiesCreated([servo]);

        await pipeline.tick(0.1);
        expect(resolve).toHaveBeenLastCalledWith({ id: "dev-1", event: event("mqtt", { uuid: SERVO_UUID }) });
        expect(servo.updateComponent).toHaveBeenCalledWith("debug_name", { value: "on" });
    });
});

//------------------------------------------------------------------------------
describe("EventMapping type-level constraints", () => {
    // These assertions are checked by `npm run typecheck` (tsconfig.test.json includes ./tests),
    // not at run time: they cover what the *compiler* now rejects, which is what the merged
    // `updates` field and the flattened `entities` union replaced runtime throws with.
    it("rejects malformed mappings at compile time", () => {
        const template = { name: "AGV-{id}", components: {} };

        // @ts-expect-error — `entities` cannot both look an entity up and spawn one.
        const both: EventMapping = { entities: { byName: "{id}", spawn: template }, updates: () => null };

        // @ts-expect-error — a spawned entity lands at the scene root, so it takes no linkage.
        const linked: EventMapping = { entities: { spawn: template, linkage: [SERVO_UUID] }, updates: () => null };

        // @ts-expect-error — `updates` returns `{ id, update }` entries, not a bare component patch.
        const patch: EventMapping = { entities: { byName: "{id}" }, updates: () => ({ debug_name: { value: "x" } }) };

        expect([both, linked, patch]).toHaveLength(3);
    });
});

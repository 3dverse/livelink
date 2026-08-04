import { describe, it, expect, vi, beforeEach } from "vitest";

import { IngestionPipeline } from "../sources/data/IngestionPipeline";
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
        expect(stats.per_mapping[0]).toMatchObject({ index: 0, channel: "mqtt", events_matched: 1, updates_applied: 1 });
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

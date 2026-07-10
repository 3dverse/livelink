import { describe, expect, it, vi } from "vitest";
import { ScriptEventEmitted, ScriptEventReceived } from "../../sources/scene/ScriptEvents";
import type { Entity } from "../../sources/scene/Entity";
import type { Scene } from "../../sources/scene/Scene";
import type { RTID } from "@3dverse/livelink.core";

const fakeEntity = {} as Entity;

// ---------------------------------------------------------------------------

describe("ScriptEventReceived", () => {
    it("type is the event_name passed to the constructor", () => {
        const evt = new ScriptEventReceived({ event_name: "my-event", emitter_entity: null, data_object: {} });
        expect(evt.type).toBe("my-event");
    });

    it("stores emitter_entity and data_object", () => {
        const payload = { x: 1 };
        const evt = new ScriptEventReceived({ event_name: "e", emitter_entity: fakeEntity, data_object: payload });
        expect(evt.emitter_entity).toBe(fakeEntity);
        expect(evt.data_object).toBe(payload);
    });

    it("accepts null emitter_entity", () => {
        const evt = new ScriptEventReceived({ event_name: "e", emitter_entity: null, data_object: {} });
        expect(evt.emitter_entity).toBeNull();
    });
});

// ---------------------------------------------------------------------------

describe("ScriptEventEmitted", () => {
    function makeScene(found: Entity | null = null): Scene {
        return { _findEntity: vi.fn().mockResolvedValue(found) } as unknown as Scene;
    }

    it("type is the event_name passed to the constructor", () => {
        const evt = new ScriptEventEmitted({
            scene: makeScene(),
            event_name: "my-event",
            emitter_entity: fakeEntity,
            target_rtids: [],
            data_object: {},
        });
        expect(evt.type).toBe("my-event");
    });

    it("stores emitter_entity and data_object", () => {
        const payload = { y: 2 };
        const evt = new ScriptEventEmitted({
            scene: makeScene(),
            event_name: "e",
            emitter_entity: fakeEntity,
            target_rtids: [],
            data_object: payload,
        });
        expect(evt.emitter_entity).toBe(fakeEntity);
        expect(evt.data_object).toBe(payload);
    });

    it("target_entities resolves by calling scene._findEntity for each rtid", async () => {
        const scene = makeScene();
        const rtids = [1n, 2n] as RTID[];
        const evt = new ScriptEventEmitted({
            scene,
            event_name: "e",
            emitter_entity: fakeEntity,
            target_rtids: rtids,
            data_object: {},
        });

        await evt.target_entities;

        expect(scene._findEntity).toHaveBeenCalledTimes(2);
        expect(scene._findEntity).toHaveBeenCalledWith({ entity_rtid: 1n });
        expect(scene._findEntity).toHaveBeenCalledWith({ entity_rtid: 2n });
    });

    it("target_entities is lazily computed and returns the same Promise on repeated access", () => {
        const evt = new ScriptEventEmitted({
            scene: makeScene(),
            event_name: "e",
            emitter_entity: fakeEntity,
            target_rtids: [],
            data_object: {},
        });

        expect(evt.target_entities).toBe(evt.target_entities);
    });
});

import { describe, expect, it } from "vitest";
import { EntitiesCreatedEvent, EntitiesDeletedEvent, SceneSettingsUpdatedEvent } from "../../sources/scene/SceneEvents";
import type { Entity } from "../../sources/scene/Entity";
import type { RTID } from "@3dverse/livelink.core";

// ---------------------------------------------------------------------------

describe("EntitiesCreatedEvent", () => {
    it("type is on-entities-created", () => {
        const evt = new EntitiesCreatedEvent({ entities: [], emitter: null });
        expect(evt.type).toBe("on-entities-created");
    });

    it("stores the entities array", () => {
        const entities = [{} as Entity, {} as Entity];
        const evt = new EntitiesCreatedEvent({ entities, emitter: null });
        expect(evt.entities).toBe(entities);
    });

    it("isLocal() returns true when emitter is null", () => {
        expect(new EntitiesCreatedEvent({ entities: [], emitter: null }).isLocal()).toBe(true);
    });
});

// ---------------------------------------------------------------------------

describe("EntitiesDeletedEvent", () => {
    it("type is on-entities-deleted", () => {
        const evt = new EntitiesDeletedEvent({ entity_ids: [], emitter: null });
        expect(evt.type).toBe("on-entities-deleted");
    });

    it("stores entity_ids", () => {
        const ids = [1n, 2n] as RTID[];
        const evt = new EntitiesDeletedEvent({ entity_ids: ids, emitter: null });
        expect(evt.entity_ids).toBe(ids);
    });

    describe("includes", () => {
        it("returns true when the entity's rtid is in the list", () => {
            const evt = new EntitiesDeletedEvent({ entity_ids: [42n as RTID], emitter: null });
            expect(evt.includes({ rtid: 42n as RTID } as Entity)).toBe(true);
        });

        it("returns false when the entity's rtid is not in the list", () => {
            const evt = new EntitiesDeletedEvent({ entity_ids: [42n as RTID], emitter: null });
            expect(evt.includes({ rtid: 99n as RTID } as Entity)).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------

describe("SceneSettingsUpdatedEvent", () => {
    it("type is on-scene-settings-updated", () => {
        const evt = new SceneSettingsUpdatedEvent({ updated_settings: {}, emitter: null });
        expect(evt.type).toBe("on-scene-settings-updated");
    });

    it("stores updated_settings", () => {
        const settings = { display: { maxFPS: 60 } };
        const evt = new SceneSettingsUpdatedEvent({ updated_settings: settings, emitter: null });
        expect(evt.updated_settings).toBe(settings);
    });
});

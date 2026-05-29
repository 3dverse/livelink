import { describe, expect, it } from "vitest";
import { EntityHoveredEvent, EntityPickedEvent } from "../../sources/rendering/camera/ViewportEvents";
import type { Entity } from "../../sources/scene/Entity";
import type { Vec3 } from "@3dverse/livelink.core";

const fakeEntity = {} as Entity;
const pos: Vec3 = [1, 2, 3];
const normal: Vec3 = [0, 1, 0];

// ---------------------------------------------------------------------------

describe("EntityHoveredEvent", () => {
    it("type is on-entity-hovered", () => {
        const evt = new EntityHoveredEvent({ hovered_entity: null, ws_position: null, ws_normal: null });
        expect(evt.type).toBe("on-entity-hovered");
    });

    it("stores hovered_entity, ws_position, and ws_normal", () => {
        const evt = new EntityHoveredEvent({ hovered_entity: fakeEntity, ws_position: pos, ws_normal: normal });
        expect(evt.hovered_entity).toBe(fakeEntity);
        expect(evt.ws_position).toBe(pos);
        expect(evt.ws_normal).toBe(normal);
    });

    it("accepts null values for all fields", () => {
        const evt = new EntityHoveredEvent({ hovered_entity: null, ws_position: null, ws_normal: null });
        expect(evt.hovered_entity).toBeNull();
        expect(evt.ws_position).toBeNull();
        expect(evt.ws_normal).toBeNull();
    });
});

// ---------------------------------------------------------------------------

describe("EntityPickedEvent", () => {
    it("type is on-entity-picked", () => {
        const evt = new EntityPickedEvent({ picked_entity: null, ws_position: null, ws_normal: null });
        expect(evt.type).toBe("on-entity-picked");
    });

    it("stores picked_entity, ws_position, and ws_normal", () => {
        const evt = new EntityPickedEvent({ picked_entity: fakeEntity, ws_position: pos, ws_normal: normal });
        expect(evt.picked_entity).toBe(fakeEntity);
        expect(evt.ws_position).toBe(pos);
        expect(evt.ws_normal).toBe(normal);
    });
});

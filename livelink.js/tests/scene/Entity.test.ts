import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScriptDataObject, UUID } from "@3dverse/livelink.core";
import { EntityUpdatedEvent, EntityVisibilityChangedEvent } from "../../sources/scene/EntityEvents";
import { ScriptEventReceived } from "../../sources/scene/ScriptEvents";
import type { Scene } from "../../sources/scene/Scene";
import { EntityRegistry } from "../../sources/scene/EntityRegistry";
import { createMockScene, makeEntity } from "../helpers/mock-scene";

let scene: Scene;
let registry: EntityRegistry;

beforeEach(() => {
    ({ scene, registry } = createMockScene());
});

// ---------------------------------------------------------------------------

describe("component proxy mutation", () => {
    it("marks entity dirty on first component assignment", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        expect(entity._dirty_components).toContain("debug_name");
    });

    it("marks entity dirty when a nested property is mutated through the proxy", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "initial" };
        entity._clearDirtyState();

        entity.debug_name!.value = "mutated";

        expect(entity._dirty_components).toContain("debug_name");
    });

    it("marks entity dirty when the same component is assigned a second time", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "first" };
        entity._clearDirtyState();

        entity.debug_name = { value: "second" };

        expect(entity._dirty_components).toContain("debug_name");
    });

    it("marks a component as deleted when assigned undefined", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        entity._clearDirtyState();

        entity.debug_name = undefined;

        expect(entity._deleted_components).toContain("debug_name");
        expect(entity._dirty_components).not.toContain("debug_name");
    });

    it("fires on-entity-updated with new_components on first assignment", () => {
        const entity = makeEntity(scene);
        const handler = vi.fn<(e: EntityUpdatedEvent) => void>();
        entity.addEventListener("on-entity-updated", handler);

        entity.debug_name = { value: "test" };

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].new_components).toContain("debug_name");
        expect(handler.mock.calls[0][0].updated_components).not.toContain("debug_name");
    });

    it("fires on-entity-updated with updated_components on subsequent assignment", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "first" };

        const handler = vi.fn<(e: EntityUpdatedEvent) => void>();
        entity.addEventListener("on-entity-updated", handler);

        entity.debug_name = { value: "second" };

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].updated_components).toContain("debug_name");
        expect(handler.mock.calls[0][0].new_components).not.toContain("debug_name");
    });

    it("fires on-entity-updated with deleted_components when a component is removed", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };

        const handler = vi.fn<(e: EntityUpdatedEvent) => void>();
        entity.addEventListener("on-entity-updated", handler);

        entity.debug_name = undefined;

        expect(handler.mock.calls[0][0].deleted_components).toContain("debug_name");
    });
});

// ---------------------------------------------------------------------------

describe("auto_broadcast", () => {
    it("entity with auto_broadcast=false does not appear in persist commands", () => {
        const { scene: s, registry } = createMockScene();
        const entity = makeEntity(s);
        entity.auto_broadcast = false;

        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities();

        expect(registry._flushPersistentEntities()).toHaveLength(0);
    });

    it("setting auto_broadcast=false after a flush removes entity from the persist list", () => {
        const { scene: s, registry } = createMockScene();
        const entity = makeEntity(s);

        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities(); // entity queued for persistence

        entity.auto_broadcast = false;

        expect(registry._flushPersistentEntities()).toHaveLength(0);
    });

    it("entity with auto_broadcast=true (default) appears in both update and persist commands", () => {
        const { scene: s, registry } = createMockScene();
        const entity = makeEntity(s);

        entity.debug_name = { value: "test" };
        const updates = registry._flushDirtyEntities();
        const persists = registry._flushPersistentEntities();

        expect(updates).toHaveLength(1);
        expect(persists).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------

describe("visibility", () => {
    it("is_visible is true by default", () => {
        const entity = makeEntity(scene);
        expect(entity.is_visible).toBe(true);
    });

    it("local visibility change fires event with change_source 'local'", () => {
        const entity = makeEntity(scene);
        let received: EntityVisibilityChangedEvent | null = null;
        entity.addEventListener("on-entity-visibility-changed", e => {
            received = e;
        });

        entity.is_visible = false;

        expect(received).not.toBeNull();
        expect(received!.change_source).toBe("local");
        expect(received!.is_visible).toBe(false);
    });

    it("external visibility change fires event with change_source 'external'", () => {
        const entity = makeEntity(scene);
        let received: EntityVisibilityChangedEvent | null = null;
        entity.addEventListener("on-entity-visibility-changed", e => {
            received = e;
        });

        entity._onVisibilityChanged({ is_visible: false });

        expect(received!.change_source).toBe("external");
        expect(received!.is_visible).toBe(false);
    });

    it("is_visible reflects the last value set locally", () => {
        const entity = makeEntity(scene);
        entity.is_visible = false;
        expect(entity.is_visible).toBe(false);

        entity.is_visible = true;
        expect(entity.is_visible).toBe(true);
    });
});

// ---------------------------------------------------------------------------

describe("parent / reparenting", () => {
    it("throws when reparenting creates a direct cycle", () => {
        const a = makeEntity(scene);
        const b = makeEntity(scene, a);

        expect(() => {
            a.parent = b;
        }).toThrow("Cannot reparent");
    });

    it("throws when reparenting creates an indirect cycle", () => {
        const a = makeEntity(scene);
        const b = makeEntity(scene, a);
        const c = makeEntity(scene, b);

        expect(() => {
            a.parent = c;
        }).toThrow("Cannot reparent");
    });

    it("throws on self-parenting", () => {
        const a = makeEntity(scene);

        expect(() => {
            a.parent = a;
        }).toThrow("Cannot reparent");
    });

    it("allows reparenting to a valid ancestor's sibling", () => {
        const a = makeEntity(scene);
        const b = makeEntity(scene, a);
        const c = makeEntity(scene);

        expect(() => {
            b.parent = c;
        }).not.toThrow();
    });

    it("allows setting parent to null (detach)", () => {
        const a = makeEntity(scene);
        const b = makeEntity(scene, a);

        expect(() => {
            b.parent = null;
        }).not.toThrow();
        expect(b.parent).toBeNull();
    });
});

// ---------------------------------------------------------------------------

describe("script event listeners", () => {
    // The listener key is `event_map_id + "/" + event_name`.
    // ScriptEventReceived.type must equal that compound key for the listener to fire —
    // which means the server's event_name field must include the event_map_id prefix.
    function makeScriptEvent(event_map_id: UUID, event_name: string, data_object: ScriptDataObject = {}): ScriptEventReceived {
        return new ScriptEventReceived({
            event_name: `${event_map_id}/${event_name}`,
            emitter_entity: null,
            data_object,
        });
    }

    it("onReceived fires when the entity receives the matching script event", () => {
        const entity = makeEntity(scene);
        const event_map_id = crypto.randomUUID() as UUID;
        const handler = vi.fn();
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler });

        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(event_map_id, "on-hit") });

        expect(handler).toHaveBeenCalledOnce();
    });

    it("onReceived does not fire for a different event_name", () => {
        const entity = makeEntity(scene);
        const event_map_id = crypto.randomUUID() as UUID;
        const handler = vi.fn();
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler });

        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(event_map_id, "on-miss") });

        expect(handler).not.toHaveBeenCalled();
    });

    it("onReceived does not fire for a different event_map_id", () => {
        const entity = makeEntity(scene);
        const event_map_id = crypto.randomUUID() as UUID;
        const other_map_id = crypto.randomUUID() as UUID;
        const handler = vi.fn();
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler });

        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(other_map_id, "on-hit") });

        expect(handler).not.toHaveBeenCalled();
    });

    it("removeScriptEventListener stops the handler from firing", () => {
        const entity = makeEntity(scene);
        const event_map_id = crypto.randomUUID() as UUID;
        const handler = vi.fn();
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler });
        entity.removeScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler });

        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(event_map_id, "on-hit") });

        expect(handler).not.toHaveBeenCalled();
    });

    it("two listeners on different event_map_ids fire independently", () => {
        const entity = makeEntity(scene);
        const map_a = crypto.randomUUID() as UUID;
        const map_b = crypto.randomUUID() as UUID;
        const handler_a = vi.fn();
        const handler_b = vi.fn();
        entity.addScriptEventListener({ event_map_id: map_a, event_name: "on-hit", onReceived: handler_a });
        entity.addScriptEventListener({ event_map_id: map_b, event_name: "on-hit", onReceived: handler_b });

        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(map_a, "on-hit") });

        expect(handler_a).toHaveBeenCalledOnce();
        expect(handler_b).not.toHaveBeenCalled();
    });

    it("removing one listener does not affect the other", () => {
        const entity = makeEntity(scene);
        const event_map_id = crypto.randomUUID() as UUID;
        const handler_a = vi.fn();
        const handler_b = vi.fn();
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler_a });
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler_b });
        entity.removeScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler_a });

        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(event_map_id, "on-hit") });

        expect(handler_a).not.toHaveBeenCalled();
        expect(handler_b).toHaveBeenCalledOnce();
    });

    it("passes data_object to the handler", () => {
        const entity = makeEntity(scene);
        const event_map_id = crypto.randomUUID() as UUID;
        const handler = vi.fn<(e: ScriptEventReceived) => void>();
        entity.addScriptEventListener({ event_map_id, event_name: "on-hit", onReceived: handler });

        const payload: ScriptDataObject = { damage: 42 };
        entity._onScriptEventReceived({ script_event_received_event: makeScriptEvent(event_map_id, "on-hit", payload) });

        expect(handler.mock.calls[0][0].data_object).toEqual(payload);
    });
});

// ---------------------------------------------------------------------------

describe("_setLocalTransform (external update path)", () => {
    it("updates local position without marking the entity dirty", () => {
        const entity = makeEntity(scene);

        entity._setLocalTransform({ local_transform: { position: [7, 8, 9] } });

        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });

    it("reflects the new position on the local_transform getter", () => {
        const entity = makeEntity(scene);

        entity._setLocalTransform({ local_transform: { position: [1, 2, 3] } });

        const pos = entity.local_transform.position;
        expect(pos[0]).toBeCloseTo(1);
        expect(pos[1]).toBeCloseTo(2);
        expect(pos[2]).toBeCloseTo(3);
    });

    it("invalidates the global transform so it is recalculated on next access", () => {
        const entity = makeEntity(scene);
        void entity.global_transform.position; // prime the cache

        entity._setLocalTransform({ local_transform: { position: [5, 0, 0] } });

        expect(entity.global_transform.position[0]).toBeCloseTo(5);
    });
});

// ---------------------------------------------------------------------------

describe("_applyComponentsUpdate (server sync path)", () => {
    it("sets a non-transform component without marking the entity dirty", () => {
        const entity = makeEntity(scene);

        entity._applyComponentsUpdate({
            components: { debug_name: { value: "from-server" } },
            dispatch_event: false,
        });

        expect(registry._flushDirtyEntities()).toHaveLength(0);
        expect(entity.debug_name?.value).toBe("from-server");
    });

    it("updates local_transform via _setLocalTransform without marking dirty", () => {
        const entity = makeEntity(scene);

        entity._applyComponentsUpdate({
            components: { local_transform: { position: [4, 5, 6] } },
            dispatch_event: false,
        });

        expect(registry._flushDirtyEntities()).toHaveLength(0);
        expect(entity.local_transform.position[0]).toBeCloseTo(4);
    });

    it("removes a component listed in deleted_components without marking dirty", () => {
        const entity = makeEntity(scene);
        entity.debug_name = { value: "test" };
        registry._flushDirtyEntities(); // clear existing dirty state

        entity._applyComponentsUpdate({
            components: {},
            deleted_components: ["debug_name"],
            dispatch_event: false,
        });

        expect(entity.debug_name).toBeUndefined();
        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });

    it("fires on-entity-updated when dispatch_event is true", () => {
        const entity = makeEntity(scene);
        const handler = vi.fn<(e: EntityUpdatedEvent) => void>();
        entity.addEventListener("on-entity-updated", handler);

        entity._applyComponentsUpdate({
            components: { debug_name: { value: "from-server" } },
            dispatch_event: true,
            emitter: null,
        });

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].updated_components).toContain("debug_name");
    });

    it("does not fire on-entity-updated when dispatch_event is false", () => {
        const entity = makeEntity(scene);
        const handler = vi.fn();
        entity.addEventListener("on-entity-updated", handler);

        entity._applyComponentsUpdate({
            components: { debug_name: { value: "from-server" } },
            dispatch_event: false,
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it("skips the euid key and does not treat it as a component", () => {
        const entity = makeEntity(scene);

        expect(() =>
            entity._applyComponentsUpdate({
                components: { euid: entity.euid },
                dispatch_event: false,
            }),
        ).not.toThrow();
        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe("Entity constructor internals", () => {
    it("auto_broadcast defaults to true", () => {
        const entity = makeEntity(scene);
        expect(entity.auto_broadcast).toBe(true);
    });

    it("registers itself in the scene registry on construction", () => {
        const { scene: s, registry } = createMockScene();
        const entity = makeEntity(s);
        expect(registry.get({ entity_rtid: entity.rtid })).toBe(entity);
    });

    it("parent is accessible immediately after construction", () => {
        const parent = makeEntity(scene);
        const child = makeEntity(scene, parent);
        expect(child.parent).toBe(parent);
    });

    it("exposes id from euid.value", () => {
        const entity = makeEntity(scene);
        expect(typeof entity.id).toBe("string");
        expect(entity.id).toMatch(/^[0-9a-f-]{36}$/);
    });
});

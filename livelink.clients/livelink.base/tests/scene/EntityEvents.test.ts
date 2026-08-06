import { describe, expect, it } from "vitest";
import { EntityUpdatedEvent, EntityVisibilityChangedEvent } from "../../sources/scene/EntityEvents";
import type { Client } from "../../sources/session/Client";

const fakeClient = {} as Client;

// ---------------------------------------------------------------------------

describe("EntityUpdatedEvent", () => {
    function makeEvent({
        new_components = [],
        updated_components = [],
        deleted_components = [],
        emitter = null,
    }: Partial<ConstructorParameters<typeof EntityUpdatedEvent>[0]> = {}): EntityUpdatedEvent {
        return new EntityUpdatedEvent({ new_components, updated_components, deleted_components, emitter });
    }

    it("type is on-entity-updated", () => {
        expect(makeEvent().type).toBe("on-entity-updated");
    });

    it("change_source is local when emitter is null", () => {
        expect(makeEvent({ emitter: null }).change_source).toBe("local");
    });

    it("change_source is external when emitter is a client", () => {
        expect(makeEvent({ emitter: fakeClient }).change_source).toBe("external");
    });

    it("stores the three component arrays", () => {
        const evt = makeEvent({
            new_components: ["debug_name"],
            updated_components: ["local_transform"],
            deleted_components: ["camera"],
        });
        expect(evt.new_components).toContain("debug_name");
        expect(evt.updated_components).toContain("local_transform");
        expect(evt.deleted_components).toContain("camera");
    });

    describe("isAnyComponentDirty", () => {
        it("returns true when a queried component is in new_components", () => {
            const evt = makeEvent({ new_components: ["debug_name"] });
            expect(evt.isAnyComponentDirty({ components: ["debug_name"] })).toBe(true);
        });

        it("returns true when a queried component is in updated_components", () => {
            const evt = makeEvent({ updated_components: ["local_transform"] });
            expect(evt.isAnyComponentDirty({ components: ["local_transform"] })).toBe(true);
        });

        it("returns true when a queried component is in deleted_components", () => {
            const evt = makeEvent({ deleted_components: ["camera"] });
            expect(evt.isAnyComponentDirty({ components: ["camera"] })).toBe(true);
        });

        it("returns false when none of the queried components match", () => {
            const evt = makeEvent({ updated_components: ["local_transform"] });
            expect(evt.isAnyComponentDirty({ components: ["camera"] })).toBe(false);
        });
    });

    describe("includes", () => {
        it("returns true when the component is in new_components", () => {
            const evt = makeEvent({ new_components: ["debug_name"] });
            expect(evt.includes("debug_name")).toBe(true);
        });

        it("returns true when one of multiple arguments matches", () => {
            const evt = makeEvent({ updated_components: ["local_transform"] });
            expect(evt.includes("camera", "local_transform")).toBe(true);
        });

        it("returns false when no argument matches", () => {
            const evt = makeEvent({ updated_components: ["local_transform"] });
            expect(evt.includes("camera")).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------

describe("EntityVisibilityChangedEvent", () => {
    it("type is on-entity-visibility-changed", () => {
        expect(new EntityVisibilityChangedEvent({ change_source: "local", is_visible: true }).type).toBe(
            "on-entity-visibility-changed",
        );
    });

    it("stores change_source and is_visible", () => {
        const evt = new EntityVisibilityChangedEvent({ change_source: "external", is_visible: false });
        expect(evt.change_source).toBe("external");
        expect(evt.is_visible).toBe(false);
    });
});

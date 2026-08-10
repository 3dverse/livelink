import { describe, expect, it } from "vitest";

import type { EntityUpdatedEvent } from "../../sources/scene/EntityEvents";
import { createMockScene, makeEntity } from "../helpers/mock-scene";

//------------------------------------------------------------------------------
// Documents the `is_new` polarity of `_markComponentAsDirty` end-to-end: a
// component created by `updateComponent` is reported in `new_components`, an
// update to an existing one in `updated_components`. Closes a review question
// suspecting the flag was inverted.
//------------------------------------------------------------------------------
describe("EntityUpdatedEvent component classification through updateComponent", () => {
    it("reports a created component in new_components", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        const events: Array<EntityUpdatedEvent> = [];
        entity.addEventListener("on-entity-updated", event => {
            events.push(event);
        });

        entity.updateComponent("camera", { renderGraphRef: "render-graph" });

        expect(events).toHaveLength(1);
        expect(events[0].new_components).toContain("camera");
        expect(events[0].updated_components).not.toContain("camera");
    });

    it("reports an updated component in updated_components", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("camera", { renderGraphRef: "render-graph" });

        const events: Array<EntityUpdatedEvent> = [];
        entity.addEventListener("on-entity-updated", event => {
            events.push(event);
        });

        entity.updateComponent("camera", { renderGraphRef: "another-render-graph" });

        expect(events).toHaveLength(1);
        expect(events[0].updated_components).toContain("camera");
        expect(events[0].new_components).not.toContain("camera");
    });

    it("reports a mutate-then-flag update in updated_components", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("camera", { renderGraphRef: "render-graph" });

        const events: Array<EntityUpdatedEvent> = [];
        entity.addEventListener("on-entity-updated", event => {
            events.push(event);
        });

        entity.updateComponent("camera");

        expect(events).toHaveLength(1);
        expect(events[0].updated_components).toContain("camera");
        expect(events[0].new_components).not.toContain("camera");
    });
});

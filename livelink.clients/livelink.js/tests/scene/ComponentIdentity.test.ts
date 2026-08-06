import { describe, expect, it } from "vitest";

import { createMockScene } from "@livelink.base/../tests/helpers/mock-scene";
import { makeEntity } from "../helpers/mock-scene";

//------------------------------------------------------------------------------
// Regression tests for two refactor regressions flagged by review:
// - transform proxies must keep wrapping the live arrays across updateComponent
//   merges (the base merge must not replace the arrays the proxies captured),
// - component getters must return a stable proxy so reference identity works
//   (React dependency arrays, Map keys, `!==` change detection).
//------------------------------------------------------------------------------

describe("local_transform proxy liveness across updateComponent", () => {
    it("keeps a captured position array live after a patch", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        const position = entity.local_transform.position;

        entity.updateComponent("local_transform", { position: [9, 8, 7] });

        // The captured reference reads the patched values...
        expect(position[0]).toBe(9);
        expect(position[1]).toBe(8);
        expect(position[2]).toBe(7);
        // ...and agrees with a fresh read through the proxy.
        expect(entity.local_transform.position[0]).toBe(9);
    });

    it("still routes writes through the captured reference after a patch", () => {
        const { scene, registry } = createMockScene();
        const entity = makeEntity(scene);

        const position = entity.local_transform.position;
        entity.updateComponent("local_transform", { position: [1, 2, 3] });
        registry._flushDirtyEntities();

        position[1] = 42;

        // The write landed on the stored component, not on an orphaned array.
        expect(entity.getComponent("local_transform")!.position[1]).toBe(42);
        expect(entity.local_transform.position[1]).toBe(42);
        // And it flagged the entity dirty again.
        expect(registry._flushDirtyEntities()).toHaveLength(1);
    });

    it("exposes the recomputed eulerOrientation through the proxy after an orientation-only patch", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        const eulerOrientation = entity.local_transform.eulerOrientation;

        // 90° yaw as a quaternion; the euler counterpart is recomputed by the base.
        entity.updateComponent("local_transform", { orientation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] });

        expect(eulerOrientation[2]).toBeCloseTo(90, 4);
        expect(entity.local_transform.eulerOrientation[2]).toBeCloseTo(90, 4);
    });
});

//------------------------------------------------------------------------------
describe("component getter identity", () => {
    it("returns the same proxy on every access", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("camera", { renderGraphRef: "render-graph" });

        expect(entity.camera).toBe(entity.camera);
    });

    it("keeps the same proxy across an updateComponent merge", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("camera", { renderGraphRef: "render-graph" });

        const camera = entity.camera;
        entity.updateComponent("camera", { renderGraphRef: "another-render-graph" });

        expect(entity.camera).toBe(camera);
        expect(camera!.renderGraphRef).toBe("another-render-graph");
    });

    it("returns undefined after deletion and a fresh proxy for a recreated component", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("camera", { renderGraphRef: "render-graph" });

        const stale = entity.camera;
        entity.deleteComponent("camera");
        expect(entity.camera).toBeUndefined();

        entity.updateComponent("camera", { renderGraphRef: "recreated-render-graph" });
        const recreated = entity.camera;

        expect(recreated).not.toBe(stale);
        expect(recreated!.renderGraphRef).toBe("recreated-render-graph");
    });
});

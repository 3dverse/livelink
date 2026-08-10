import { describe, it, expect } from "vitest";

import type { Quat, Vec3 } from "@3dverse/livelink.core";
import { createMockScene, makeEntity } from "../helpers/mock-scene";

//------------------------------------------------------------------------------
// A 90° yaw, in both representations.
const YAW_90_QUAT: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
const YAW_90_EULER: Vec3 = [0, 0, 90];

//------------------------------------------------------------------------------
function expectVecClose(actual: ReadonlyArray<number>, expected: ReadonlyArray<number>): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], 4);
    }
}

//------------------------------------------------------------------------------
describe("updateComponent('local_transform') keeps orientation and eulerOrientation in sync", () => {
    it("recomputes eulerOrientation when only orientation is provided", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        entity.updateComponent("local_transform", { orientation: YAW_90_QUAT });

        const local_transform = entity.getComponent("local_transform")!;
        expectVecClose(local_transform.orientation, YAW_90_QUAT);
        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
    });

    it("recomputes orientation when only eulerOrientation is provided", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        entity.updateComponent("local_transform", { eulerOrientation: YAW_90_EULER });

        const local_transform = entity.getComponent("local_transform")!;
        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
        expectVecClose(local_transform.orientation, YAW_90_QUAT);
    });

    it("recomputes eulerOrientation when updating orientation on an existing component", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        // Seed an identity transform, then rotate via the quaternion only.
        entity.updateComponent("local_transform", { position: [1, 2, 3] });
        entity.updateComponent("local_transform", { orientation: YAW_90_QUAT });

        const local_transform = entity.getComponent("local_transform")!;
        expectVecClose(local_transform.position, [1, 2, 3]);
        expectVecClose(local_transform.orientation, YAW_90_QUAT);
        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
    });

    it("trusts both values when the caller provides orientation and eulerOrientation", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        // Deliberately inconsistent: the caller owns both, so neither is recomputed.
        entity.updateComponent("local_transform", { orientation: YAW_90_QUAT, eulerOrientation: [0, 0, 0] });

        const local_transform = entity.getComponent("local_transform")!;
        expectVecClose(local_transform.orientation, YAW_90_QUAT);
        expectVecClose(local_transform.eulerOrientation, [0, 0, 0]);
    });
});

//------------------------------------------------------------------------------
// Contract of the explicit component model: a handle obtained from `getComponent` (and any
// nested array pulled off it) stays live across patch merges — `updateComponent` merges in
// place instead of replacing objects. The documented mutate-then-flag pattern and the browser
// SDK's transform proxies both depend on it.
describe("patch merges preserve component and array identity", () => {
    it("keeps the component object and its nested arrays across updateComponent patches", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);

        entity.updateComponent("local_transform", { position: [1, 2, 3] });
        const component_ref = entity.getComponent("local_transform")!;
        const position_ref = component_ref.position;
        const scale_ref = component_ref.scale;

        entity.updateComponent("local_transform", { position: [4, 5, 6], scale: [2, 2, 2] });

        expect(entity.getComponent("local_transform")).toBe(component_ref);
        expect(component_ref.position).toBe(position_ref);
        expect(component_ref.scale).toBe(scale_ref);
        expectVecClose(position_ref, [4, 5, 6]);
        expectVecClose(scale_ref, [2, 2, 2]);
    });
});

//------------------------------------------------------------------------------
describe("mutate-then-flag keeps orientation and eulerOrientation in sync", () => {
    it("recomputes eulerOrientation when the caller mutated orientation", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        const local_transform = entity.getComponent("local_transform")!;
        local_transform.orientation = [...YAW_90_QUAT] as Quat;
        entity.updateComponent("local_transform");

        expectVecClose(local_transform.orientation, YAW_90_QUAT);
        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
    });

    it("recomputes orientation when the caller mutated eulerOrientation", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        const local_transform = entity.getComponent("local_transform")!;
        local_transform.eulerOrientation = [...YAW_90_EULER] as Vec3;
        entity.updateComponent("local_transform");

        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
        expectVecClose(local_transform.orientation, YAW_90_QUAT);
    });

    it("recomputes when a single element of the quaternion is mutated in place", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        const local_transform = entity.getComponent("local_transform")!;
        local_transform.orientation[2] = YAW_90_QUAT[2];
        local_transform.orientation[3] = YAW_90_QUAT[3];
        entity.updateComponent("local_transform");

        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
    });

    it("leaves the rotation pair untouched when only position was mutated", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { orientation: YAW_90_QUAT });

        const local_transform = entity.getComponent("local_transform")!;
        local_transform.position[1] = 5;
        entity.updateComponent("local_transform");

        expectVecClose(local_transform.position, [0, 5, 0]);
        expectVecClose(local_transform.orientation, YAW_90_QUAT);
        expectVecClose(local_transform.eulerOrientation, YAW_90_EULER);
    });

    it("trusts both representations when the caller mutated both", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        const local_transform = entity.getComponent("local_transform")!;
        // Deliberately inconsistent: the caller owns both, so neither is recomputed.
        local_transform.orientation = [...YAW_90_QUAT] as Quat;
        local_transform.eulerOrientation = [0, 0, 45];
        entity.updateComponent("local_transform");

        expectVecClose(local_transform.orientation, YAW_90_QUAT);
        expectVecClose(local_transform.eulerOrientation, [0, 0, 45]);
    });

    it("re-syncs through updateComponents as well", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        const local_transform = entity.getComponent("local_transform")!;
        local_transform.eulerOrientation = [...YAW_90_EULER] as Vec3;
        entity.updateComponents(["local_transform"]);

        expectVecClose(local_transform.orientation, YAW_90_QUAT);
    });

    it("attributes a mutation correctly after a server-driven update", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        // Server-driven update rotates via the quaternion.
        entity._applyComponentsUpdate({
            components: { local_transform: { orientation: [...YAW_90_QUAT] as Quat } },
            dispatch_event: false,
        });

        // The caller then mutates the euler representation: it must win over the server quat.
        const local_transform = entity.getComponent("local_transform")!;
        local_transform.eulerOrientation = [0, 0, 45];
        entity.updateComponent("local_transform");

        expectVecClose(local_transform.eulerOrientation, [0, 0, 45]);
        expectVecClose(local_transform.orientation, [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)]);
    });

    it("preserves the array identities of the rotation pair across a re-sync", () => {
        const { scene } = createMockScene();
        const entity = makeEntity(scene);
        entity.updateComponent("local_transform", { position: [1, 2, 3] });

        const local_transform = entity.getComponent("local_transform")!;
        const orientation_ref = local_transform.orientation;
        const euler_ref = local_transform.eulerOrientation;

        orientation_ref[2] = YAW_90_QUAT[2];
        orientation_ref[3] = YAW_90_QUAT[3];
        entity.updateComponent("local_transform");

        expect(local_transform.orientation).toBe(orientation_ref);
        expect(local_transform.eulerOrientation).toBe(euler_ref);
        expectVecClose(euler_ref, YAW_90_EULER);
    });
});

import { beforeEach, describe, expect, it } from "vitest";
import { EntityRegistry } from "@livelink.base/scene/EntityRegistry";
import { createMockScene, makeEntity, MockScene } from "../helpers/mock-scene";

let scene: MockScene;
let registry: EntityRegistry;

beforeEach(() => {
    ({ scene, registry } = createMockScene());
});

// ---------------------------------------------------------------------------

describe("root entity global transform", () => {
    it("global position equals local position", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { position: [3, 4, 5] };

        const pos = entity.global_transform.position;

        expect(pos[0]).toBeCloseTo(3);
        expect(pos[1]).toBeCloseTo(4);
        expect(pos[2]).toBeCloseTo(5);
    });

    it("global orientation equals local orientation", () => {
        const entity = makeEntity(scene);
        // 90° around Z: [0, 0, sin(π/4), cos(π/4)]
        const q: [number, number, number, number] = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
        entity.local_transform = { orientation: q };

        const ori = entity.global_transform.orientation;

        expect(ori[0]).toBeCloseTo(0);
        expect(ori[1]).toBeCloseTo(0);
        expect(ori[2]).toBeCloseTo(Math.SQRT1_2);
        expect(ori[3]).toBeCloseTo(Math.SQRT1_2);
    });

    it("global scale equals local scale", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { scale: [2, 3, 4] };

        const s = entity.global_transform.scale;

        expect(s[0]).toBeCloseTo(2);
        expect(s[1]).toBeCloseTo(3);
        expect(s[2]).toBeCloseTo(4);
    });
});

// ---------------------------------------------------------------------------

describe("child entity global transform", () => {
    it("child global position = parent position + local position (no rotation)", () => {
        const parent = makeEntity(scene);
        const child = makeEntity(scene, parent);

        parent.local_transform = { position: [10, 0, 0] };
        child.local_transform = { position: [3, 0, 0] };

        const pos = child.global_transform.position;

        expect(pos[0]).toBeCloseTo(13);
        expect(pos[1]).toBeCloseTo(0);
        expect(pos[2]).toBeCloseTo(0);
    });

    it("child global scale = parent scale * local scale", () => {
        const parent = makeEntity(scene);
        const child = makeEntity(scene, parent);

        parent.local_transform = { scale: [2, 2, 2] };
        child.local_transform = { scale: [3, 3, 3] };

        const s = child.global_transform.scale;

        expect(s[0]).toBeCloseTo(6);
        expect(s[1]).toBeCloseTo(6);
        expect(s[2]).toBeCloseTo(6);
    });

    it("child global transform updates lazily when parent moves", () => {
        const parent = makeEntity(scene);
        const child = makeEntity(scene, parent);

        parent.local_transform = { position: [5, 0, 0] };
        child.local_transform = { position: [1, 0, 0] };
        expect(child.global_transform.position[0]).toBeCloseTo(6);

        parent.local_transform = { position: [10, 0, 0] };
        expect(child.global_transform.position[0]).toBeCloseTo(11);
    });
});

// ---------------------------------------------------------------------------

describe("setting global transform derives local transform", () => {
    it("setting global_transform.position on a root entity updates local position", () => {
        const entity = makeEntity(scene);
        entity.global_transform = { position: [7, 8, 9] };

        const lp = entity.local_transform.position;

        expect(lp[0]).toBeCloseTo(7);
        expect(lp[1]).toBeCloseTo(8);
        expect(lp[2]).toBeCloseTo(9);
    });

    it("setting global_transform.position on a child derives the correct local position", () => {
        const parent = makeEntity(scene);
        const child = makeEntity(scene, parent);

        parent.local_transform = { position: [10, 0, 0] };
        child.global_transform = { position: [15, 0, 0] };

        const lp = child.local_transform.position;

        expect(lp[0]).toBeCloseTo(5);
        expect(lp[1]).toBeCloseTo(0);
        expect(lp[2]).toBeCloseTo(0);
    });

    it("setting global_transform.scale on a child derives the correct local scale", () => {
        const parent = makeEntity(scene);
        const child = makeEntity(scene, parent);

        parent.local_transform = { scale: [4, 4, 4] };
        child.global_transform = { scale: [8, 8, 8] };

        const ls = child.local_transform.scale;

        expect(ls[0]).toBeCloseTo(2);
        expect(ls[1]).toBeCloseTo(2);
        expect(ls[2]).toBeCloseTo(2);
    });
});

// ---------------------------------------------------------------------------

describe("ls_to_ws matrix", () => {
    it("is identity for a root entity at the origin with unit scale", () => {
        const entity = makeEntity(scene);
        const m = entity.ls_to_ws;

        // gl-matrix identity: diagonal is 1, rest is 0
        expect(m[0]).toBeCloseTo(1); // col 0 row 0
        expect(m[5]).toBeCloseTo(1); // col 1 row 1
        expect(m[10]).toBeCloseTo(1); // col 2 row 2
        expect(m[15]).toBeCloseTo(1); // col 3 row 3
        expect(m[12]).toBeCloseTo(0); // tx
        expect(m[13]).toBeCloseTo(0); // ty
        expect(m[14]).toBeCloseTo(0); // tz
    });

    it("translation appears at indices [12], [13], [14] (column-major)", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { position: [1, 2, 3] };

        const m = entity.ls_to_ws;

        expect(m[12]).toBeCloseTo(1);
        expect(m[13]).toBeCloseTo(2);
        expect(m[14]).toBeCloseTo(3);
    });

    it("non-uniform scale appears on the diagonal", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { scale: [2, 3, 4] };

        const m = entity.ls_to_ws;

        expect(m[0]).toBeCloseTo(2);
        expect(m[5]).toBeCloseTo(3);
        expect(m[10]).toBeCloseTo(4);
    });

    it("90° Z rotation rotates the x-axis to the y-axis (column-major)", () => {
        const entity = makeEntity(scene);
        // [0, 0, sin(π/4), cos(π/4)] = 90° around Z
        entity.local_transform = { orientation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] };

        const m = entity.ls_to_ws;

        // Column 0 (transformed x-axis): should point along +Y
        expect(m[0]).toBeCloseTo(0);
        expect(m[1]).toBeCloseTo(1);
        // Column 1 (transformed y-axis): should point along -X
        expect(m[4]).toBeCloseTo(-1);
        expect(m[5]).toBeCloseTo(0);
    });
});

// ---------------------------------------------------------------------------

describe("global_aabb", () => {
    it("default aabb (no local_aabb component) spans [-1,1] in each axis", () => {
        const entity = makeEntity(scene);
        const aabb = entity.global_aabb;

        expect(aabb.min[0]).toBeCloseTo(-1);
        expect(aabb.min[1]).toBeCloseTo(-1);
        expect(aabb.min[2]).toBeCloseTo(-1);
        expect(aabb.max[0]).toBeCloseTo(1);
        expect(aabb.max[1]).toBeCloseTo(1);
        expect(aabb.max[2]).toBeCloseTo(1);
    });

    it("default aabb center is at the origin", () => {
        const entity = makeEntity(scene);
        const { center } = entity.global_aabb;

        expect(center[0]).toBeCloseTo(0);
        expect(center[1]).toBeCloseTo(0);
        expect(center[2]).toBeCloseTo(0);
    });

    it("default aabb longest_edge_length is 2 (unit cube edge)", () => {
        const entity = makeEntity(scene);
        expect(entity.global_aabb.longest_edge_length).toBeCloseTo(2);
    });

    it("translation moves the aabb center", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { position: [5, 0, 0] };
        const { center, min, max } = entity.global_aabb;

        expect(center[0]).toBeCloseTo(5);
        expect(min[0]).toBeCloseTo(4);
        expect(max[0]).toBeCloseTo(6);
    });

    it("uniform scale grows the aabb and its longest_edge_length", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { scale: [3, 3, 3] };
        const aabb = entity.global_aabb;

        expect(aabb.min[0]).toBeCloseTo(-3);
        expect(aabb.max[0]).toBeCloseTo(3);
        expect(aabb.longest_edge_length).toBeCloseTo(6);
    });
});

// ---------------------------------------------------------------------------

describe("dirty tracking via transforms", () => {
    it("mutating local_transform.position marks local_transform dirty", () => {
        const entity = makeEntity(scene);
        entity.local_transform.position[0] = 5;

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("local_transform");
    });

    it("assigning local_transform marks local_transform dirty", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { position: [1, 2, 3] };

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("local_transform");
    });

    it("assigning global_transform marks local_transform dirty", () => {
        const entity = makeEntity(scene);
        entity.global_transform = { position: [5, 0, 0] };

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("local_transform");
    });

    it("mutating global_transform.position through the proxy marks local_transform dirty", () => {
        const entity = makeEntity(scene);
        entity.global_transform.position[0] = 7;

        const commands = registry._flushDirtyEntities();

        expect(commands).toHaveLength(1);
        expect(commands[0].dirty_components).toContain("local_transform");
    });

    it("dirty state is cleared after _flushDirtyEntities()", () => {
        const entity = makeEntity(scene);
        entity.local_transform = { position: [1, 0, 0] };
        registry._flushDirtyEntities();

        expect(registry._flushDirtyEntities()).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe("mutate-then-flag on the raw stored local_transform", () => {
    // `getComponent` returns the raw stored value, bypassing the transform proxies: flagging must
    // re-sync the two rotation representations and the derived global transform.

    it("re-syncs eulerOrientation and the global transform when orientation was mutated", () => {
        const entity = makeEntity(scene);

        const raw = entity.getComponent("local_transform")!;
        // 90° around Z, mutated element-wise (the transform proxies capture the array references).
        raw.orientation[2] = Math.SQRT1_2;
        raw.orientation[3] = Math.SQRT1_2;
        entity.updateComponent("local_transform");

        expect(raw.eulerOrientation[2]).toBeCloseTo(90, 4);
        // The proxy view reads the same live array.
        expect(entity.local_transform.eulerOrientation[2]).toBeCloseTo(90, 4);

        // The global transform was flagged dirty and reflects the new rotation.
        const ori = entity.global_transform.orientation;
        expect(ori[2]).toBeCloseTo(Math.SQRT1_2);
        expect(ori[3]).toBeCloseTo(Math.SQRT1_2);
    });

    it("re-syncs orientation when eulerOrientation was mutated", () => {
        const entity = makeEntity(scene);

        const raw = entity.getComponent("local_transform")!;
        raw.eulerOrientation[2] = 90;
        entity.updateComponent("local_transform");

        expect(raw.orientation[2]).toBeCloseTo(Math.SQRT1_2, 4);
        expect(raw.orientation[3]).toBeCloseTo(Math.SQRT1_2, 4);
    });

    it("attributes a raw euler mutation correctly after a server-driven update", () => {
        const entity = makeEntity(scene);

        // Server-driven update rotates via the quaternion (routed through _setLocalTransform).
        entity._applyComponentsUpdate({
            components: { local_transform: { orientation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] } },
            dispatch_event: false,
        });

        // The caller then mutates the euler representation: it must win over the server quat.
        const raw = entity.getComponent("local_transform")!;
        raw.eulerOrientation[2] = 45;
        entity.updateComponent("local_transform");

        expect(raw.eulerOrientation[2]).toBeCloseTo(45, 4);
        expect(raw.orientation[2]).toBeCloseTo(Math.sin(Math.PI / 8), 4);
        expect(raw.orientation[3]).toBeCloseTo(Math.cos(Math.PI / 8), 4);
    });
});

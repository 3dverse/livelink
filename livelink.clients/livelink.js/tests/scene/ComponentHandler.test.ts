import { describe, expect, it, vi } from "vitest";
import { ComponentHandler } from "../../sources/scene/ComponentHandler";
import type { Entity } from "../../sources/scene/Entity";
import type { ComponentName } from "@3dverse/livelink.core";

function makeProxy<T extends object>(
    target: T,
    component_name: ComponentName = "debug_name",
): { proxy: T; entity: Entity } {
    const entity = { _markComponentAsDirty: vi.fn() } as unknown as Entity;
    const handler = new ComponentHandler(entity, component_name);
    return { proxy: new Proxy(target, handler) as T, entity };
}

// ---------------------------------------------------------------------------

describe("set trap", () => {
    it("marks the component dirty", () => {
        const { proxy, entity } = makeProxy<{ x: number }>({ x: 0 });
        proxy.x = 1;
        expect(entity._markComponentAsDirty).toHaveBeenCalledOnce();
    });

    it("marks with the correct component name", () => {
        const { proxy, entity } = makeProxy<{ x: number }>({ x: 0 }, "local_transform");
        proxy.x = 1;
        expect(entity._markComponentAsDirty).toHaveBeenCalledWith({ component_name: "local_transform" });
    });

    it("actually writes the value to the target", () => {
        const target = { x: 0 };
        const { proxy } = makeProxy(target);
        proxy.x = 99;
        expect(target.x).toBe(99);
    });
});

// ---------------------------------------------------------------------------

describe("deleteProperty trap", () => {
    it("marks the component dirty", () => {
        const { proxy, entity } = makeProxy<{ x?: number }>({ x: 1 });
        delete proxy.x;
        expect(entity._markComponentAsDirty).toHaveBeenCalledOnce();
    });

    it("actually removes the property from the target", () => {
        const target: { x?: number } = { x: 1 };
        const { proxy } = makeProxy(target);
        delete proxy.x;
        expect("x" in target).toBe(false);
    });
});

// ---------------------------------------------------------------------------

describe("get trap", () => {
    it("returns a primitive value directly", () => {
        const { proxy } = makeProxy({ n: 42 });
        expect(proxy.n).toBe(42);
    });

    it("wraps an object property in a nested proxy", () => {
        const inner = { y: 0 };
        const { proxy, entity } = makeProxy({ inner });

        proxy.inner.y = 7;

        // dirty was called by the nested proxy's set trap
        expect(entity._markComponentAsDirty).toHaveBeenCalledOnce();
        expect(inner.y).toBe(7);
    });

    it("wraps an array property in a nested proxy", () => {
        const arr = [0, 0, 0];
        const { proxy, entity } = makeProxy({ arr });

        proxy.arr[0] = 5;

        expect(entity._markComponentAsDirty).toHaveBeenCalledOnce();
        expect(arr[0]).toBe(5);
    });
});

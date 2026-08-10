import { describe, expect, it } from "vitest";

import type { ComponentName } from "@3dverse/livelink.core";
import { ComponentProxyCache } from "../../sources/scene/ComponentProxyCache";
// The cache types its entity as the shared core's Entity, as ComponentHandler does; the browser
// Entity handed out by makeEntity is a subclass of it.
import type { Entity } from "@livelink.base/scene/Entity";
import { createMockScene, makeEntity } from "../helpers/mock-scene";

//------------------------------------------------------------------------------
// A pass-through handler that records its constructions, to observe cache hits vs rebuilds.
class RecordingHandler implements ProxyHandler<never> {
    static constructed: Array<{ entity: Entity; component_name: ComponentName }> = [];

    constructor(entity: Entity, component_name: ComponentName) {
        RecordingHandler.constructed.push({ entity, component_name });
    }

    get(target: object, prop: PropertyKey): unknown {
        return Reflect.get(target, prop);
    }
}

function makeCacheAndEntity(): { cache: ComponentProxyCache; entity: Entity } {
    RecordingHandler.constructed = [];
    const { scene } = createMockScene();
    return { cache: new ComponentProxyCache(), entity: makeEntity(scene) };
}

//------------------------------------------------------------------------------
describe("ComponentProxyCache", () => {
    it("returns undefined for an absent component", () => {
        const { cache, entity } = makeCacheAndEntity();

        const proxy = cache.wrap({
            entity,
            component_name: "point_light",
            value: undefined,
            ComponentHandler: RecordingHandler,
        });

        expect(proxy).toBeUndefined();
        expect(RecordingHandler.constructed).toHaveLength(0);
    });

    it("hands back the same proxy while the stored value is unchanged", () => {
        const { cache, entity } = makeCacheAndEntity();
        const value = { intensity: 1 } as never;

        const first = cache.wrap({ entity, component_name: "point_light", value, ComponentHandler: RecordingHandler });
        const second = cache.wrap({ entity, component_name: "point_light", value, ComponentHandler: RecordingHandler });

        expect(second).toBe(first);
        expect(RecordingHandler.constructed).toHaveLength(1);
        expect(RecordingHandler.constructed[0]).toEqual({ entity, component_name: "point_light" });
    });

    it("rebuilds the proxy when the stored value is replaced", () => {
        const { cache, entity } = makeCacheAndEntity();
        const first_value = { intensity: 1 } as never;
        const second_value = { intensity: 2 } as never;

        const first = cache.wrap({
            entity,
            component_name: "point_light",
            value: first_value,
            ComponentHandler: RecordingHandler,
        });
        const second = cache.wrap({
            entity,
            component_name: "point_light",
            value: second_value,
            ComponentHandler: RecordingHandler,
        });

        expect(second).not.toBe(first);
        expect(RecordingHandler.constructed).toHaveLength(2);
    });

    it("drops the cache entry when the component disappears, and rebuilds on return", () => {
        const { cache, entity } = makeCacheAndEntity();
        const value = { intensity: 1 } as never;

        const first = cache.wrap({ entity, component_name: "point_light", value, ComponentHandler: RecordingHandler });
        const gone = cache.wrap({
            entity,
            component_name: "point_light",
            value: undefined,
            ComponentHandler: RecordingHandler,
        });
        const back = cache.wrap({ entity, component_name: "point_light", value, ComponentHandler: RecordingHandler });

        expect(gone).toBeUndefined();
        expect(back).not.toBe(first);
        expect(RecordingHandler.constructed).toHaveLength(2);
    });

    it("proxies reads through to the wrapped value", () => {
        const { cache, entity } = makeCacheAndEntity();
        const value = { intensity: 3 } as never;

        const proxy = cache.wrap({ entity, component_name: "point_light", value, ComponentHandler: RecordingHandler });

        expect((proxy as { intensity: number }).intensity).toBe(3);
    });
});

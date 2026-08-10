import type { UUID } from "@3dverse/livelink.core";
import { Entity } from "../../sources/scene/Entity";
import type { MockScene } from "@livelink.base/../tests/helpers/mock-scene";
export { createMockScene, MockScene } from "@livelink.base/../tests/helpers/mock-scene";

/**
 * In production, an RTID is xxhash(euid, linker_euid_0, linker_euid_1, ...).
 * In tests we use a monotonic counter as a stand-in, which satisfies the only
 * invariant the registry cares about: RTIDs are unique per registered entity.
 */
let _rtid = 1n;

export function makeEntity(scene: MockScene, parent: Entity | null = null): Entity {
    return new Entity({
        scene,
        parent,
        components: {
            euid: {
                value: crypto.randomUUID() as UUID,
                rtid: _rtid++,
            },
        },
    });
}

/**
 * Creates two or more entities that share the same EUID but carry different lineage chains,
 * mirroring what the server produces when a SceneRef is instanced multiple times.
 *
 * Each entry in `linkage` is the ordered list of linker UUIDs that leads to
 * this particular instance.  In production the RTID would be
 * xxhash(euid, ...linkage); here we use the counter.
 */
export function makeLinkedEntities(scene: MockScene, euid: UUID, linkages: [UUID, ...UUID[]][]): Entity[] {
    return linkages.map(
        linkage =>
            new Entity({
                scene,
                parent: null,
                components: {
                    euid: { value: euid, rtid: _rtid++ },
                    lineage: { value: linkage, parentUUID: linkage.at(-1)!, ordinal: 0 },
                },
            }),
    );
}

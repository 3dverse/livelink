import type { ComponentName, ComponentType, UUID } from "@3dverse/livelink.core";
import { EntityRegistry } from "../../sources/scene/EntityRegistry";
import { Entity } from "../../sources/scene/Entity";
import type { Scene } from "../../sources/scene/Scene";

// Mirrors the `EntityScene` that Entity's constructor accepts: structural, so no cast is needed and
// the compiler flags a stub that drifts out of sync with what Entity actually calls.
export type MockScene = Pick<
    Scene,
    | "_entity_registry"
    | "_sanitizeComponentValue"
    | "_onEntityReparented"
    | "_setEntityVisibility"
    | "_resolveEmitter"
    | "_assignClientToScripts"
    | "_getChildren"
    | "_findEntity"
>;

function freshLocalTransform(
    value?: Partial<{
        position: unknown;
        orientation: unknown;
        scale: unknown;
        eulerOrientation: unknown;
        globalEulerOrientation: unknown;
    }>,
): {
    position: [number, number, number];
    orientation: [number, number, number, number];
    scale: [number, number, number];
    eulerOrientation: [number, number, number];
    globalEulerOrientation: [number, number, number];
} {
    return {
        position: [...((value?.position as number[]) ?? [0, 0, 0])] as [number, number, number],
        orientation: [...((value?.orientation as number[]) ?? [0, 0, 0, 1])] as [number, number, number, number],
        scale: [...((value?.scale as number[]) ?? [1, 1, 1])] as [number, number, number],
        eulerOrientation: [...((value?.eulerOrientation as number[]) ?? [0, 0, 0])] as [number, number, number],
        globalEulerOrientation: [...((value?.globalEulerOrientation as number[]) ?? [0, 0, 0])] as [
            number,
            number,
            number,
        ],
    };
}

export function createMockScene(): { scene: MockScene; registry: EntityRegistry } {
    const registry = new EntityRegistry();

    const scene: MockScene = {
        _entity_registry: registry,
        _sanitizeComponentValue<N extends ComponentName>({
            component_name,
            value,
        }: {
            component_name: N;
            value: Partial<ComponentType<N>> | undefined;
        }): ComponentType<N> {
            if (component_name === "local_transform") {
                return freshLocalTransform(value as Parameters<typeof freshLocalTransform>[0]) as ComponentType<N>;
            }
            return (value ?? {}) as ComponentType<N>;
        },
        _onEntityReparented: () => {},
        _setEntityVisibility: () => Promise.resolve(),
        _resolveEmitter: () => null,
        _assignClientToScripts: () => {},
        _getChildren: () => Promise.resolve([]),
        _findEntity: () => Promise.resolve(null),
    };

    return { scene, registry };
}

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

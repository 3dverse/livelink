//------------------------------------------------------------------------------
import type { Entity, Quat, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { useEntities } from "./useEntities";

/**
 * A point of view extracted from a `label` component.
 *
 * @category Hooks
 */
export type LabelPointOfView = {
    /**
     * The entity carrying the `label` component.
     */
    entity: Entity;

    /**
     * The parent of the entity, or null if the entity is at the root of the scene.
     */
    parent: Entity | null;

    /**
     * The ancestors of the entity, ordered from the root of the scene down to its parent.
     */
    ancestors: Array<Entity>;

    /**
     * The label's title.
     */
    title: string;

    /**
     * The camera position stored on the label.
     */
    position: Vec3;

    /**
     * The camera orientation stored on the label.
     */
    orientation: Quat;
};

/**
 * A hook that finds every entity with a `label` component in the scene and extracts the
 * point of view stored on each of them.
 *
 * The points of view are sorted in scene graph order (depth-first, siblings ordered by
 * their `lineage.ordinal`).
 *
 * @returns The points of view and a flag indicating if they're still being fetched.
 *
 * @category Hooks
 */
export function useLabelPointsOfView(): {
    isPending: boolean;
    pointsOfView: Array<LabelPointOfView>;
} {
    const { isPending, entities } = useEntities({ mandatory_components: ["label"] }, ["label", "lineage"]);

    const pointsOfView = entities
        .flatMap((entity): Array<LabelPointOfView & { ordinalPath: Array<number> }> => {
            const label = entity.label;
            if (!label) {
                return [];
            }

            const ancestors = getAncestors(entity);

            return [
                {
                    entity,
                    parent: entity.parent,
                    ancestors,
                    title: label.title,
                    position: label.camera.slice(0, 3) as Vec3,
                    orientation: label.camera.slice(3, 7) as Quat,
                    ordinalPath: [...ancestors, entity].map(e => e.lineage?.ordinal ?? 0),
                },
            ];
        })
        .sort((a, b) => compareOrdinalPaths(a.ordinalPath, b.ordinalPath))
        .map(({ ordinalPath: _, ...pointOfView }) => pointOfView);

    return { isPending, pointsOfView };
}

/**
 * Returns the ancestors of the entity, ordered from the root of the scene down to its parent.
 */
function getAncestors(entity: Entity): Array<Entity> {
    const ancestors: Array<Entity> = [];
    for (let current = entity.parent; current; current = current.parent) {
        ancestors.unshift(current);
    }
    return ancestors;
}

/**
 * Compares two ordinal paths in depth-first order: an ancestor comes before its descendants.
 */
function compareOrdinalPaths(a: Array<number>, b: Array<number>): number {
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; ++i) {
        if (a[i] !== b[i]) {
            return a[i]! - b[i]!;
        }
    }
    return a.length - b.length;
}

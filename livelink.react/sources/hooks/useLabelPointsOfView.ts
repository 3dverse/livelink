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
 * @returns The points of view and a flag indicating if they're still being fetched.
 *
 * @category Hooks
 */
export function useLabelPointsOfView(): {
    isPending: boolean;
    pointsOfView: Array<LabelPointOfView>;
} {
    const { isPending, entities } = useEntities({ mandatory_components: ["label"] }, ["label"]);

    const pointsOfView = entities.flatMap((entity): Array<LabelPointOfView> => {
        const label = entity.label;
        if (!label) {
            return [];
        }

        return [
            {
                entity,
                title: label.title,
                position: label.camera.slice(0, 3) as Vec3,
                orientation: label.camera.slice(3, 7) as Quat,
            },
        ];
    });

    return { isPending, pointsOfView };
}

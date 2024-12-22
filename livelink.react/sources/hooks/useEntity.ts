//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink as LivelinkInstance,
    Entity,
    type UUID,
    ComponentsRecord,
    RenderGraphDataObject,
    EntityCreationOptions,
    Vec3,
    Quat,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * @description An entity provider.
 */
export type EntityId = { id: UUID };

/**
 * @description An entity instance.
 */
export type EntityInstance = { name: string; components: ComponentsRecord; options: EntityCreationOptions };
export type EntityFinder = {
    finder: ({ instance }: { instance: LivelinkInstance }) => Promise<Entity | null>;
};

export type EntityProvider = EntityId | EntityInstance | EntityFinder;

/**
 * @description A hook that provides an entity and a flag indicating if the entity is pending loading.
 *
 * @example
 * ```tsx
 * const { isPending, entity } = useEntity({ id: "00000000-0000-0000-0000-000000000000" });
 * if (isPending) {
 *     return <div>Loading...</div>;
 * }
 * if (!entity) {
 *     return <div>Entity not found</div>;
 * }
 * return <div>Entity found: {entity.name}</div>;
 * ```
 *
 * @category Hooks
 * @param {EntityProvider} entityProvider - The entity provider.
 * @returns The entity and a flag indicating if the entity is pending loading.
 */
export function useEntity(entityProvider: EntityProvider): { isPending: boolean; entity: Entity | null } {
    const { instance } = useContext(LivelinkContext);

    const [entity, setEntity] = useState<Entity | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const entityId = entityProvider as EntityId;
    const entityFinder = entityProvider as EntityFinder;

    useEffect(() => {
        if (!instance) {
            return;
        }

        const resolveEntity = async () => {
            if ("id" in entityProvider) {
                console.debug("---- Finding entity with id", entityProvider.id);
                return await instance.scene.findEntity({ entity_uuid: entityProvider.id });
            } else if ("components" in entityProvider) {
                console.debug("---- Creating entity");
                return await instance.scene.newEntity(entityProvider);
            } else {
                return await entityProvider.finder({ instance });
            }
        };

        resolveEntity()
            .then(foundEntity => {
                setEntity(foundEntity);
            })
            .finally(() => {
                setIsPending(false);
            });

        return () => {
            setEntity(null);
            setIsPending(true);
        };
    }, [instance, entityId.id, entityFinder.finder]);

    useEffect(() => {
        if (!entity) {
            return;
        }
        entity.addEventListener("entity-updated", forceUpdate);

        return () => {
            entity.removeEventListener("entity-updated", forceUpdate);
        };
    }, [entity]);

    return { isPending, entity };
}

//------------------------------------------------------------------------------
export function useCameraEntity(
    props: {
        name?: string;
        position?: Vec3;
        orientation?: Quat;
        renderGraphRef?: UUID;
        settings?: RenderGraphDataObject;
        renderTargetIndex?: number;
    } = {
        name: "Camera",
        position: [0, 1, 5],
        orientation: [0, 0, 0, 1],
        renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
        renderTargetIndex: -1,
    },
): {
    isPending: boolean;
    cameraEntity: Entity | null;
} {
    const { isPending, entity: cameraEntity } = useEntity({
        name: props.name ?? "Camera",
        components: {
            local_transform: { position: props.position ?? [0, 1, 5], orientation: props.orientation ?? [0, 0, 0, 1] },
            camera: {
                renderGraphRef: props.renderGraphRef ?? "398ee642-030a-45e7-95df-7147f6c43392",
                dataJSON: props.settings ?? { grid: true, skybox: false, gradient: true },
                renderTargetIndex: props.renderTargetIndex ?? -1,
            },
            perspective_lens: {
                fovy: 60,
                nearPlane: 0.1,
                farPlane: 10000,
            },
        },
        options: { auto_broadcast: false, delete_on_client_disconnection: true },
    });

    return { isPending, cameraEntity };
}

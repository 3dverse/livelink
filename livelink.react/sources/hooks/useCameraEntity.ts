//------------------------------------------------------------------------------
import type { Vec3, Quat, RenderGraphDataObject, Entity, UUID } from "@3dverse/livelink";
import { useEntity } from "./useEntity";

/**
 * A hook that creates a camera entity.
 *
 * @param props
 * @param props.name - The name of the camera entity.
 * @param props.position - The initial position of the camera entity.
 * @param props.orientation - The initial orientation of the camera entity.
 * @param props.renderGraphRef - The render graph to use within the camera entity.
 * @param props.settings - The settings of the camera entity.
 * @param props.renderTargetIndex - The render target index to use to render the frame.
 *
 * @category Hooks
 */
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

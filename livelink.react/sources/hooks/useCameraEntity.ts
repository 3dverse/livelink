//------------------------------------------------------------------------------
import type { Vec3, Quat, RenderGraphDataObject, Entity, UUID, ComponentName, Components } from "@3dverse/livelink";
import { useEntity } from "./useEntity";
import { StrictUnion } from "../utils";

/**
 * An exclusive union of the perspective and orthographic lenses.
 * @inline
 * @internal
 */
export type CameraLensProps =
    | {
          /**
           * The perspective lens of the camera entity, can't be used with orthographic_lens.
           */
          perspective_lens?: Partial<Components.PerspectiveLens>;
      }
    | {
          /**
           * The orthographic lens of the camera entity, can't be used with perspective_lens.
           */
          orthographic_lens?: Partial<Components.OrthographicLens>;
      };

/**
 * The properties of the render graph the camera will entity use.
 * @inline
 * @internal
 */
export type RenderGraphProps = {
    /**
     * The render graph to use within the camera entity.
     */
    renderGraphRef?: UUID;

    /**
     * The settings of the camera entity.
     */
    settings?: RenderGraphDataObject;

    /**
     * The render target index to use to render the frame.
     */
    renderTargetIndex?: number;
};

/**
 * The properties of the initial transform of the camera entity.
 * Defines an exclusive union between orientation and eulerOrientation.
 * @inline
 * @internal
 */
export type OrientationProps =
    | {
          /**
           * The initial orientation of the camera entity in quaternion form, can't be used with eulerOrientation.
           */
          orientation?: Quat;
      }
    | {
          /**
           * The initial orientation of the camera entity in Euler angles form, can't be used with orientation.
           */
          eulerOrientation?: Vec3;
      };

/**
 * The properties used to create a camera entity.
 * @inline
 * @internal
 */
export type UseCameraEntityProps = {
    /**
     * The name of the camera entity.
     */
    name?: string;

    /**
     * The initial position of the camera entity.
     */
    position?: Vec3;
} & StrictUnion<OrientationProps> &
    StrictUnion<CameraLensProps> &
    RenderGraphProps;

/**
 * A hook that creates a camera entity.
 *
 * @param props - The properties used to create the camera entity.
 * @param watchedComponents - The components to watch for changes. If any component in this list changes,
 * the entity trigger a redraw. If set to "any", the entity will trigger a redraw on any component change.
 *
 * @returns The camera entity and a boolean indicating if the entity is pending creation.
 *
 * @category Hooks
 */
export function useCameraEntity(
    props: UseCameraEntityProps = {},
    watchedComponents: Array<ComponentName> | "any" = [],
): {
    isPending: boolean;
    cameraEntity: Entity | null;
} {
    const {
        name = "Camera",
        position = [0, 1, 5],
        orientation: _orientation = [0, 0, 0, 1],
        eulerOrientation: _eulerOrientation = [0, 0, 0],
        renderGraphRef = "398ee642-030a-45e7-95df-7147f6c43392",
        settings = { grid: true, skybox: false, gradient: true },
        renderTargetIndex = -1,
        perspective_lens: _perspective_lens = { fovy: 60, nearPlane: 0.1, farPlane: 10000 },
    } = props;

    const orientation = "orientation" in props ? _orientation : undefined;
    const eulerOrientation = !orientation && "eulerOrientation" in props ? _eulerOrientation : undefined;

    const orthographic_lens = "orthographic_lens" in props ? props.orthographic_lens : undefined;
    const perspective_lens = !orthographic_lens ? _perspective_lens : undefined;

    const { isPending, entity: cameraEntity } = useEntity(
        {
            name,
            components: {
                local_transform: { position, orientation, eulerOrientation },
                camera: { renderGraphRef, dataJSON: settings, renderTargetIndex },
                perspective_lens,
                orthographic_lens,
            },
            options: { auto_broadcast: false, delete_on_client_disconnection: true },
        },
        watchedComponents,
    );

    return { isPending, cameraEntity };
}

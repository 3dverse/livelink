//------------------------------------------------------------------------------
import type {
    Vec3,
    Quat,
    RenderGraphDataObject,
    Entity,
    UUID,
    Components,
    ComponentsManifest,
} from "@3dverse/livelink";
import { StrictUnion } from "../utils";
import { useSceneSettings } from "./useSceneSettings";
import { useContext, useEffect, useState } from "react";
import { LivelinkContext } from "../components/core/Livelink";

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
 * @internal
 */
const INVALID_RENDER_GRAPH_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * @internal
 */
const DEFAULT_RENDER_GRAPH_UUID = "398ee642-030a-45e7-95df-7147f6c43392";

/**
 * @internal
 */
const DEFAULT_RENDER_GRAPH_SETTINGS = { grid: true, skybox: false, gradient: true };

/**
 * @internal
 */
const DEFAULT_PERSPECTIVE_LENS = { fovy: 60, nearPlane: 0.1, farPlane: 10000 };

/**
 *
 */
type EntityProps = { name: string; components: ComponentsManifest } | null;

/**
 * A hook that creates a camera entity.
 *
 * @param props - The properties used to create the camera entity.
 * Once created, the camera entity will persist with this properties until
 * the component using this hook is unmounted.
 *
 * When the component is unmounted, the camera entity is deleted from the scene.
 *
 * @returns The camera entity and a boolean indicating if the entity is pending creation.
 *
 * @category Hooks
 */
export function useCameraEntity(props: UseCameraEntityProps = {}): {
    isPending: boolean;
    cameraEntity: Entity | null;
} {
    const { instance } = useContext(LivelinkContext);
    const { sceneSettings } = useSceneSettings();

    const [cameraEntity, setCameraEntity] = useState<Entity | null>(null);
    const [isPending, setIsPending] = useState(true);

    /**
     * The properties used to create the camera entity in a dedicated state.
     * This state can only be affected once per lifecycle to avoid recreating
     * the entity on every render.
     */
    const [entityProps, setEntityProps] = useState<EntityProps>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance || !sceneSettings) {
            return;
        }

        /* eslint-disable prefer-const */
        let {
            renderGraphRef: defaultRenderGraph,
            dataJSON: defaultSettings,
            renderTargetIndex: defaultRenderTargetIndex,
        } = sceneSettings.default_camera_component;

        if (defaultRenderGraph === INVALID_RENDER_GRAPH_UUID) {
            defaultRenderGraph = DEFAULT_RENDER_GRAPH_UUID;
        }

        if (Object.keys(defaultSettings).length === 0) {
            defaultSettings = DEFAULT_RENDER_GRAPH_SETTINGS;
        }

        let {
            name = "Camera",
            position = sceneSettings.default_camera_transform.position,
            orientation,
            eulerOrientation,
            renderGraphRef = defaultRenderGraph,
            settings = defaultSettings,
            renderTargetIndex = defaultRenderTargetIndex,
            perspective_lens,
            orthographic_lens,
        } = props;

        if (eulerOrientation) {
            orientation = undefined;
        } else if (!orientation) {
            orientation = sceneSettings.default_camera_transform.orientation;
        }

        if (orthographic_lens) {
            perspective_lens = undefined;
        } else if (!perspective_lens) {
            perspective_lens = DEFAULT_PERSPECTIVE_LENS;
        }

        setEntityProps(
            // Only set if not already set
            prevValue =>
                prevValue ?? {
                    name,
                    components: {
                        local_transform: { position, orientation, eulerOrientation },
                        camera: { renderGraphRef, dataJSON: settings, renderTargetIndex },
                        perspective_lens,
                        orthographic_lens,
                    },
                },
        );
    }, [instance, sceneSettings, props]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance || !entityProps) {
            return;
        }

        instance.scene
            .newEntity({ ...entityProps, options: { auto_broadcast: false, delete_on_client_disconnection: true } })
            .then(foundEntity => setCameraEntity(foundEntity))
            .finally(() => setIsPending(false));

        return (): void => {
            setCameraEntity(null);
            setIsPending(true);
        };
    }, [instance, entityProps]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance || !cameraEntity) {
            return;
        }

        return (): void => {
            instance.scene.deleteEntities({ entities: [cameraEntity] });
        };
    }, [instance, cameraEntity]);

    return { isPending, cameraEntity };
}

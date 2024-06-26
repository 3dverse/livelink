//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { DefaultCamera } from "../cameras/DefaultCamera";
import {
    Camera,
    CanvasContextAttributes,
    CanvasContextType,
    Livelink,
    SoftwareDecoder,
    UUID,
    Viewport,
    WebCodecsDecoder,
    RenderingSurface,
    Rect,
    DEFAULT_RECT,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
type View = {
    canvas_ref: React.RefObject<HTMLCanvasElement>;
    rect?: Rect;
    camera?: typeof Camera | UUID | null;
} & (
    | {
          canvas_context_type: "2d";
          canvas_context_attributes?: CanvasRenderingContext2DSettings;
      }
    | {
          canvas_context_type: "webgl";
          canvas_context_attributes?: WebGLContextAttributes & { xrCompatible?: boolean };
      }
    | {
          canvas_context_attributes?: undefined;
      }
);

//------------------------------------------------------------------------------
type LivelinkResponse = { instance: Livelink; cameras: Array<Camera | null> };

//------------------------------------------------------------------------------
export function useLivelinkInstance({ views }: { views: Array<View> }): {
    instance: Livelink | null;
    isConnecting: boolean;
    connect: ({
        scene_id,
        token,
        onConnected,
    }: {
        scene_id: UUID;
        token: string;
        onConnected?: ({ instance, cameras }: { instance: Livelink; cameras: Array<Camera | null> }) => void;
    }) => Promise<LivelinkResponse | null>;
    disconnect: () => void;
} {
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Disconnect when unmounted
    useEffect(() => {
        return () => {
            instance?.disconnect();
        };
    }, [instance]);

    return {
        instance,
        isConnecting,
        connect: async ({
            scene_id,
            token,
            onConnected,
        }: {
            scene_id: UUID;
            token: string;
            onConnected?: ({ instance, cameras }: { instance: Livelink; cameras: Array<Camera | null> }) => void;
        }): Promise<LivelinkResponse | null> => {
            if (views.some(v => v.canvas_ref.current === null)) {
                return null;
            }

            setIsConnecting(true);
            const instance = await Livelink.join_or_start({ scene_id, token });
            const cameras = await configureClient(instance, views);

            setInstance(instance);
            setIsConnecting(false);
            onConnected?.({ instance, cameras });

            return { instance, cameras };
        },
        disconnect: () => {
            instance?.viewports.forEach(v => v.camera?.onDelete());
            setInstance(null);
        },
    };
}

//------------------------------------------------------------------------------
async function configureClient(instance: Livelink, views: Array<View>) {
    const canvasToViews = new Map<HTMLCanvasElement, { surface: RenderingSurface; views: Array<View> }>();
    for (const view of views) {
        const c2v = canvasToViews.get(view.canvas_ref.current!);
        if (c2v !== undefined) {
            c2v.views.push(view);
        } else {
            const surface = new RenderingSurface({
                canvas_element: view.canvas_ref.current!,
                context_type: "canvas_context_type" in view ? view.canvas_context_type : "2d",
                context_attributes: view.canvas_context_attributes,
            });
            canvasToViews.set(view.canvas_ref.current!, { surface, views: [view] });
        }
    }

    // Step 1: configure the viewports that will receive the video stream.
    const viewports = views.map(
        view => new Viewport(instance, canvasToViews.get(view.canvas_ref.current!)!.surface, view.rect ?? DEFAULT_RECT),
    );
    instance.addViewports({ viewports });

    // Step 2: configure the client on the renderer side, this informs the
    //         renderer on the client canvas size and available input devices
    //         and most importantly activates the session.
    const webcodec = await WebCodecsDecoder.findSupportedCodec();
    await instance.configureRemoteServer({ codec: webcodec || undefined });

    // Step 3: configure the local client.
    await instance.installFrameConsumer({
        frame_consumer:
            webcodec !== null
                ? new WebCodecsDecoder(instance.default_decoded_frame_consumer)
                : new SoftwareDecoder(instance.default_decoded_frame_consumer),
    });

    // Step 4: inform the renderer of which camera to use with which viewport.
    const camera_constructors = views.map(v => (v.camera === null ? null : v.camera || DefaultCamera));
    const cameras = (await Promise.all(
        viewports.map(async (viewport, i) => {
            if (camera_constructors[i] === null) {
                return null;
            } else if (typeof camera_constructors[i] === typeof Camera) {
                return await instance.newCamera(camera_constructors[i] as typeof Camera, "MyCam_" + i++, viewport);
            } else {
                const camera = await instance.scene.findEntity(Camera, { entity_uuid: camera_constructors[i] as UUID });
                if (camera) {
                    camera.viewport = viewport;
                    viewport.camera = camera;
                }
                return camera;
            }
        }),
    )) satisfies Array<Camera | null>;

    instance.startStreaming();

    return cameras;
}

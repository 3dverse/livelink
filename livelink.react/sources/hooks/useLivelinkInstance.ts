//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { DefaultCamera } from "../cameras/DefaultCamera";
import {
    Camera,
    Livelink,
    Session,
    SoftwareDecoder,
    UUID,
    Viewport,
    WebCodecsDecoder,
    RenderingSurface,
    RelativeRect,
} from "@3dverse/livelink";

//------------------------------------------------------------------------------
type View = {
    canvas_ref: React.RefObject<HTMLCanvasElement>;
    rect?: RelativeRect;
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
        session_id,
        token,
        onConfigureClient,
        onConnected,
        is_transient,
    }: {
        scene_id: UUID;
        session_id?: UUID;
        token: string;
        onConfigureClient?: (instance: Livelink) => Promise<void>;
        onConnected?: ({ instance, cameras }: { instance: Livelink; cameras: Array<Camera | null> }) => void;
        is_transient?: boolean;
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
            session_id,
            token,
            onConfigureClient,
            onConnected,
            is_transient,
            session_open_mode,
        }: {
            scene_id: UUID;
            session_id?: UUID;
            token: string;
            onConfigureClient?: (instance: Livelink) => Promise<void>;
            onConnected?: ({ instance, cameras }: { instance: Livelink; cameras: Array<Camera | null> }) => void;
            is_transient?: boolean;
            session_open_mode?: "join" | "start" | "join_or_start";
        }): Promise<LivelinkResponse | null> => {
            if (views.some(v => v.canvas_ref.current === null)) {
                return null;
            }

            setIsConnecting(true);
            let instance: Livelink;

            if (session_open_mode === "start") {
                instance = await Livelink.start({ scene_id, token });
            } else if (session_id) {
                const session = await Session.findById({ session_id, token });
                if (!session) {
                    console.error(`Session '${session_id}' not found on scene '${scene_id}'`);
                    return null;
                }
                instance = await Livelink.join({ session });
            } else {
                if (session_open_mode === "join") {
                    console.error(`Session ID is required when session_mode is 'join'`);
                    return null;
                }
                instance = await Livelink.join_or_start({ scene_id, token, is_transient });
            }

            const viewports = registerViewports(instance, views);
            if (onConfigureClient) {
                await onConfigureClient(instance);
            } else {
                await configureClient(instance);
            }
            const cameras = await resolveCameras(instance, views, viewports);

            instance.startStreaming();

            setInstance(instance);
            setIsConnecting(false);
            onConnected?.({ instance, cameras });

            return { instance, cameras };
        },
        disconnect: () => {
            setInstance(null);
        },
    };
}

//------------------------------------------------------------------------------
function registerViewports(instance: Livelink, views: Array<View>): Array<Viewport> {
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
        view =>
            new Viewport(instance, canvasToViews.get(view.canvas_ref.current!)!.surface, {
                rect: new RelativeRect(view.rect ?? {}),
            }),
    );

    if (viewports.length > 0) {
        instance.addViewports({ viewports });
    }

    return viewports;
}

//------------------------------------------------------------------------------
async function configureClient(instance: Livelink) {
    // Step 2: configure the client on the renderer side, this informs the
    //         renderer on the client canvas size and available input devices
    //         and most importantly activates the session.
    const webcodec = await WebCodecsDecoder.findSupportedCodec();
    await instance.configureRemoteServer({ codec: webcodec || undefined });

    // Step 3: configure the local client.
    await instance.setEncodedFrameConsumer({
        encoded_frame_consumer:
            webcodec !== null
                ? new WebCodecsDecoder(instance.default_decoded_frame_consumer)
                : new SoftwareDecoder(instance.default_decoded_frame_consumer),
    });
}

//------------------------------------------------------------------------------
async function resolveCameras(
    instance: Livelink,
    views: Array<View>,
    viewports: Array<Viewport>,
): Promise<Array<Camera | null>> {
    // Step 4: inform the renderer of which camera to use with which viewport.
    const camera_constructors = views.map(v => (v.camera === null ? null : v.camera || DefaultCamera));

    // Prefetch cameras
    await Promise.all(
        camera_constructors
            .filter(camera_constructor => typeof camera_constructor === "string")
            .map(async camera_constructor => {
                return await instance.scene.findEntity(Camera, { entity_uuid: camera_constructor as UUID });
            }),
    );

    const cameras = (await Promise.all(
        viewports.map(async (viewport, i) => {
            if (camera_constructors[i] === null) {
                return null;
            }

            if (typeof camera_constructors[i] === typeof Camera) {
                return await instance.newCamera(camera_constructors[i] as typeof Camera, "MyCam_" + i++, viewport);
            }

            const camera = await instance.scene.findEntity(Camera, { entity_uuid: camera_constructors[i] as UUID });
            if (camera) {
                camera.viewport = viewport;
                viewport.camera = camera;
            }
            return camera;
        }),
    )) satisfies Array<Camera | null>;

    return cameras;
}

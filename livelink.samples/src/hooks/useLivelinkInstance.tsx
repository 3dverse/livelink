//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { DefaultCamera } from "../components/DefaultCamera";
import {
    Camera,
    CodecType,
    Livelink,
    SessionInfo,
    SoftwareDecoder,
    UUID,
    Viewport,
    WebCodecsDecoder,
} from "livelink.js";

//------------------------------------------------------------------------------
export function useLivelinkInstance({
    canvas_refs,
    camera_constructors = [],
    token,
}: {
    canvas_refs: Array<React.RefObject<HTMLCanvasElement>>;
    camera_constructors?: (typeof Camera | UUID)[];
    token: string;
}): {
    instance: Livelink | null;
    connect: ({ scene_id }: { scene_id: UUID }) => Promise<{ instance: Livelink; cameras: (Camera | null)[] } | null>;
    disconnect: () => void;
    onConnect?: (instance: Livelink) => void;
} {
    const [instance, setInstance] = useState<Livelink | null>(null);

    useEffect(() => {
        return () => {
            instance?.close();
        };
    }, [instance]);

    return {
        instance,
        connect: async ({ scene_id }: { scene_id: UUID }) => {
            if (canvas_refs.some(r => r.current === null)) {
                return null;
            }

            const instance = await Livelink.join_or_start({
                scene_id,
                token,
                session_selector: ({ sessions }: { sessions: Array<SessionInfo> }) => sessions[0],
            });

            const cameras = await configureClient(
                instance,
                canvas_refs.map(r => r.current!),
                camera_constructors,
            );

            setInstance(instance);
            return { instance, cameras };
        },
        disconnect: () => setInstance(null),
    };
}

//------------------------------------------------------------------------------
async function configureClient(
    instance: Livelink,
    canvas_elements: Array<HTMLCanvasElement>,
    camera_constructors: (typeof Camera | UUID)[],
) {
    const viewports = await Promise.all(
        canvas_elements.map(async canvas_element =>
            new Viewport(instance, {
                canvas_element,
                context_type: "2d",
            }).init(),
        ),
    );

    instance.remote_rendering_surface.addViewports({ viewports });

    const webcodec = await WebCodecsDecoder.findAppropriatedCodec({
        frame_dimensions: instance.remote_rendering_surface.dimensions,
    });

    const client_config = {
        remote_canvas_size: instance.remote_rendering_surface.dimensions,
        encoder_config: {
            codec: webcodec || CodecType.h264,
            profile: 1,
            frame_rate: 60,
            lossy: true,
        },
        supported_devices: {
            keyboard: true,
            mouse: true,
            gamepad: true,
            hololens: false,
            touchscreen: false,
        },
    };

    // Step 1: configure the client on the renderer side, this informs the
    //         renderer on the client canvas size and available input devices
    //         and most importantly activates the session.
    await instance.configureClient({ client_config });

    // Step 2: decode received frames and draw them on the canvas.
    await instance.installFrameConsumer({
        frame_consumer: webcodec
            ? new WebCodecsDecoder(instance.remote_rendering_surface)
            : new SoftwareDecoder(instance.remote_rendering_surface),
    });

    // Step 3: inform the renderer of which camera to use with which viewport.
    const cameras = (await Promise.all(
        viewports.map(async (viewport, i) => {
            if (typeof camera_constructors[i] === typeof Camera || camera_constructors[i] === undefined) {
                const CameraConstructor = (camera_constructors[i] as typeof Camera) || DefaultCamera;
                return await instance.newCamera(CameraConstructor, "MyCam_" + i++, viewport);
            } else {
                const camera = await instance.findEntity(Camera, { entity_uuid: camera_constructors[i] as UUID });
                if (camera) {
                    camera.viewport = viewport;
                    viewport.camera = camera;
                }
                return camera;
            }
        }),
    )) satisfies Array<Camera | null>;

    instance.startStreaming();
    instance.startUpdateLoop({ fps: 60 });

    return cameras;
}

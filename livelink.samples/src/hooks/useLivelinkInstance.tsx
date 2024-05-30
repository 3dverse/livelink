//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { DefaultCamera } from "../components/DefaultCamera";
import { Camera, Livelink, SessionInfo, UUID, Viewport, WebCodecsDecoder } from "livelink.js";

//------------------------------------------------------------------------------
export function useLivelinkInstance({
    canvas_refs,
    camera_constructors = [],
    token,
}: {
    canvas_refs: Array<React.RefObject<HTMLCanvasElement>>;
    camera_constructors?: (typeof Camera)[];
    token: string;
}): {
    instance: Livelink | null;
    connect: ({ scene_id }: { scene_id: UUID }) => Promise<{ instance: Livelink; cameras: Camera[] } | null>;
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
    camera_constructors: (typeof Camera)[],
) {
    const viewports = await Promise.all(
        canvas_elements.map(async canvas_element =>
            new Viewport(instance, {
                canvas_element,
            }).init(),
        ),
    );

    instance.remote_rendering_surface.addViewports({ viewports });

    const client_config = {
        remote_canvas_size: instance.remote_rendering_surface.dimensions,
        encoder_config: {
            codec: 2,
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
        frame_consumer: new WebCodecsDecoder(instance.remote_rendering_surface),
    });

    // Step 3: inform the renderer on which camera to use with which viewport.
    const cameras = await Promise.all(
        viewports.map(async (viewport, i) => {
            const CameraConstructor = camera_constructors[i] || DefaultCamera;
            return await instance.newCamera(CameraConstructor, "MyCam_" + i++, viewport);
        }),
    );

    instance.startStreaming();
    instance.startUpdateLoop({ fps: 60 });

    return cameras;
}

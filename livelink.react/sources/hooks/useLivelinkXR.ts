//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Livelink, SoftwareDecoder, UUID, WebCodecsDecoder, Session, Camera } from "@3dverse/livelink";
import { WebXRHelper } from "../web-xr/WebXRHelper";

//------------------------------------------------------------------------------
type LivelinkResponse = {
    instance: Livelink | null;
    cameras: Array<Camera>;
    webXRHelper: WebXRHelper;
};

//------------------------------------------------------------------------------
type ConnectParameters = {
    scene_id: UUID;
    session_id?: UUID;
    token: string;
    root_element?: HTMLElement;
    resolution_scale?: number;
};

//------------------------------------------------------------------------------
export function useLivelinkXR({ mode }: { mode: XRSessionMode }): {
    instance: Livelink | null;
    isConnecting: boolean;
    message: string;
    isSessionSupported: boolean;
    resolutionScale: number;
    setResolutionScale: (scale: number) => void;
    connect: (params: ConnectParameters) => Promise<LivelinkResponse | null>;
    disconnect: () => void;
} {
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [xrSession, setXRSession] = useState<WebXRHelper | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [message, setMessage] = useState<string>("");
    const [isSessionSupported, setIsSessionSupported] = useState(false);
    const [resolutionScale, setResolutionScale] = useState(1);

    //--------------------------------------------------------------------------
    useEffect(() => {
        // Disconnect when unmounted
        return () => {
            instance?.disconnect();
        };
    }, [instance]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        // Release XR session when unmounted
        return () => {
            xrSession?.release();
        };
    }, [xrSession]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!xrSession) {
            return;
        }

        console.info("Setting resolution scale to", resolutionScale);
        xrSession.resolution_scale = resolutionScale;
    }, [resolutionScale, instance]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!window.isSecureContext) {
            setMessage("WebXR requires a secure context (https).");
            return;
        }

        WebXRHelper.isSessionSupported(mode).then(supported => {
            if (!supported) {
                setMessage(`WebXR '${mode}' is not supported on this device.`);
            } else {
                setIsSessionSupported(true);
            }
        });
    }, [mode]);

    //--------------------------------------------------------------------------
    return {
        instance,
        isConnecting,
        message,
        isSessionSupported,
        resolutionScale,
        setResolutionScale,
        connect: async ({
            scene_id,
            session_id,
            token,
            root_element,
            resolution_scale,
        }: ConnectParameters): Promise<LivelinkResponse | null> => {
            const webXRHelper = new WebXRHelper(resolution_scale);
            let livelinkInstance: Livelink | null = null;
            let cameras: Array<Camera> = [];
            try {
                await webXRHelper.initialize(
                    mode,
                    root_element
                        ? {
                              optionalFeatures: ["dom-overlay"],
                              domOverlay: { root: root_element },
                          }
                        : undefined,
                );

                webXRHelper.session!.addEventListener("end", () => {
                    setInstance(null);
                    setXRSession(null);
                });

                setIsConnecting(true);

                if (session_id) {
                    const session = await Session.findById({ session_id, token });
                    if (!session) {
                        console.error(`Session '${session_id}' not found on scene '${scene_id}'`);
                        return null;
                    }
                    livelinkInstance = await Livelink.join({ session });
                } else {
                    livelinkInstance = await Livelink.join_or_start({ scene_id, token });
                }

                await configureClient(webXRHelper, livelinkInstance);

                cameras = await webXRHelper.createCameras();
                livelinkInstance.startStreaming();
                webXRHelper.start();

                setResolutionScale(webXRHelper.resolution_scale);
                setXRSession(webXRHelper);
                setInstance(livelinkInstance);
            } catch (error) {
                webXRHelper.release();
                livelinkInstance?.disconnect();
                setMessage(`Error: ${error instanceof Error ? error.message : error}`);
            } finally {
                setIsConnecting(false);

                return { instance: livelinkInstance, cameras, webXRHelper };
            }
        },
        disconnect: () => {
            setInstance(null);
            setXRSession(null);
        },
    };
}

//------------------------------------------------------------------------------
async function configureClient(webXRHelper: WebXRHelper, livelinkInstance: Livelink) {
    await webXRHelper.configureViewports(livelinkInstance);

    const webcodec = await WebCodecsDecoder.findSupportedCodec();
    await livelinkInstance.configureRemoteServer({ codec: webcodec || undefined });
    await livelinkInstance.setEncodedFrameConsumer({
        encoded_frame_consumer:
            webcodec !== null
                ? new WebCodecsDecoder(livelinkInstance.default_decoded_frame_consumer)
                : new SoftwareDecoder(livelinkInstance.default_decoded_frame_consumer),
    });
}

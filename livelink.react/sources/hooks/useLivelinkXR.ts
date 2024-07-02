//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Livelink, SoftwareDecoder, UUID, WebCodecsDecoder } from "@3dverse/livelink";
import { WebXRHelper } from "../web-xr/WebXRHelper";

//------------------------------------------------------------------------------
type LivelinkResponse = { instance: Livelink | null };

//------------------------------------------------------------------------------
export function useLivelinkXR({ mode }: { mode: XRSessionMode }): {
    instance: Livelink | null;
    isConnecting: boolean;
    message: string;
    isSessionSupported: boolean;
    connect: ({
        scene_id,
        token,
        rootElement,
    }: {
        scene_id: UUID;
        token: string;
        rootElement?: HTMLElement;
    }) => Promise<LivelinkResponse | null>;
    disconnect: () => void;
} {
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [xrSession, setXRSession] = useState<WebXRHelper | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [message, setMessage] = useState<string>("");
    const [isSessionSupported, setIsSessionSupported] = useState(false);

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
        connect: async ({
            scene_id,
            token,
            rootElement,
        }: {
            scene_id: UUID;
            token: string;
            rootElement?: HTMLElement;
        }): Promise<LivelinkResponse | null> => {
            const webXRHelper = new WebXRHelper();
            let livelinkInstance: Livelink | null = null;

            try {
                await webXRHelper.initialize(
                    mode,
                    rootElement
                        ? {
                              optionalFeatures: ["dom-overlay"],
                              domOverlay: { root: rootElement },
                          }
                        : undefined,
                );

                webXRHelper.session!.addEventListener("end", () => {
                    setInstance(null);
                    setXRSession(null);
                });

                setIsConnecting(true);

                livelinkInstance = await Livelink.join_or_start({ scene_id, token });

                await configureClient(webXRHelper, livelinkInstance);

                setXRSession(webXRHelper);
                setInstance(livelinkInstance);
            } catch (error) {
                webXRHelper.release();
                livelinkInstance?.disconnect();
                setMessage(`Error: ${error instanceof Error ? error.message : error}`);
            } finally {
                setIsConnecting(false);

                return { instance: livelinkInstance };
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
    await livelinkInstance.installFrameConsumer({
        frame_consumer:
            webcodec !== null
                ? new WebCodecsDecoder(livelinkInstance.default_decoded_frame_consumer)
                : new SoftwareDecoder(livelinkInstance.default_decoded_frame_consumer),
    });

    await webXRHelper.createCameras();
    livelinkInstance.startStreaming();
    webXRHelper.start();
}

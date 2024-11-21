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
    onConfigureClient?: (weXRHelper: WebXRHelper, instance: Livelink) => Promise<void>;
    onConnected?: ({ instance, cameras }: { instance: Livelink; cameras: Array<Camera | null> }) => void;
    onDisconnected?: (event: Event) => void;
    is_transient?: boolean;
    session_open_mode?: "join" | "start" | "join_or_start";
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
    let onDisconnectedListener: ((event: Event) => void) | null = null;

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
            onConfigureClient,
            onConnected,
            onDisconnected,
            is_transient,
            session_open_mode = "join_or_start",
            root_element,
            resolution_scale,
        }: ConnectParameters): Promise<LivelinkResponse> => {
            const webXRHelper = new WebXRHelper(resolution_scale);
            let instance: Livelink | null = null;
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

                if (["start", "join_or_start"].includes(session_open_mode) && session_id) {
                    console.warn(
                        `session_open_mode="${session_open_mode}" does not support session_id option, use session_open_mode="join".`,
                    );
                }
                switch (session_open_mode) {
                    case "start":
                        instance = await Livelink.start({ scene_id, token, is_transient });
                        break;
                    case "join":
                        if (!session_id) {
                            throw new Error(
                                `session_open_mode="${session_open_mode}" requires session_id option to be defined`,
                            );
                        }
                        const session = await Session.findById({ session_id, token });
                        if (!session) {
                            throw new Error(`Session '${session_id}' not found on scene '${scene_id}'`);
                        }
                        instance = await Livelink.join({ session });
                        break;
                    case "join_or_start":
                        instance = await Livelink.join_or_start({ scene_id, token, is_transient });
                        break;
                }

                if (onDisconnected) {
                    // Allow the hook user to be notified of a disconnection occuring while the above operations run.
                    // Still not perfect, because the gateway might disconnect before the instance is returned during
                    // the GatewayController.authenticateClient or EditorController.connectToSession of livelink-core.
                    // Also nothing's notify the livelink user of a loss of the EditorConnection.
                    instance.session.addEventListener("on-disconnected", onDisconnected);
                    onDisconnectedListener = onDisconnected;
                }

                if (onConfigureClient) {
                    await onConfigureClient(webXRHelper, instance);
                } else {
                    await configureClient(webXRHelper, instance);
                }

                cameras = await webXRHelper.createCameras();
                instance.startStreaming();
                webXRHelper.start();

                setResolutionScale(webXRHelper.resolution_scale);
                setXRSession(webXRHelper);
                setInstance(instance);
                onConnected?.({ instance, cameras });
            } catch (error) {
                webXRHelper.release();
                instance?.disconnect();
                const err = error instanceof Error ? error : new Error(`Error: ${error}`);
                setMessage(err.toString());
                throw err;
            } finally {
                setIsConnecting(false);
                return { instance, cameras, webXRHelper };
            }
        },
        disconnect: () => {
            setInstance(null);
            setXRSession(null);
            if (onDisconnectedListener) {
                instance?.session.removeEventListener("on-disconnected", onDisconnectedListener);
            }
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

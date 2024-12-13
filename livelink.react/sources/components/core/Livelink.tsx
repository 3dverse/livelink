import React, { useCallback, useEffect, useState } from "react";

import { Livelink, Session, SoftwareDecoder, WebCodecsDecoder, type UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const LivelinkContext = React.createContext<{
    instance: Livelink | null;
    isConnecting: boolean;
    disconnect: () => void;
}>({
    instance: null,
    isConnecting: false,
    disconnect: () => {},
});

//------------------------------------------------------------------------------
export type LivelinkConnectParameters = {
    scene_id: UUID;
    session_id?: UUID;
    token: string;
    onDisconnected?: (event: Event) => void;
    is_transient?: boolean;
    session_open_mode?: "join" | "start" | "join_or_start";

    loader?: React.ReactNode;
    inactivityTimeoutModal?: React.ReactNode;
    disconnectedModal?: React.ReactNode;
};

//------------------------------------------------------------------------------
export function LivelinkProvider({
    children,
    scene_id,
    session_id,
    is_transient,
    token,
    loader,
    onDisconnected,
    inactivityTimeoutModal,
    disconnectedModal,
    session_open_mode = "join_or_start",
}: React.PropsWithChildren<LivelinkConnectParameters>) {
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isDisconnected, setIsDisconnected] = useState(false);

    const disconnect = useCallback(() => {
        instance?.disconnect();
    }, [instance]);

    const onDisconnectedHandler = useCallback(
        (event: Event) => {
            setIsDisconnected(true);
            onDisconnected?.(event);
        },
        [instance, onDisconnected],
    );

    useEffect(() => {
        setIsConnecting(true);
        setIsDisconnected(false);

        const connect = async () => {
            if (["start", "join_or_start"].includes(session_open_mode) && session_id) {
                console.warn(
                    `session_open_mode="${session_open_mode}" does not support session_id option, use session_open_mode="join".`,
                );
            }

            switch (session_open_mode) {
                case "start":
                    return Livelink.start({ scene_id, token, is_transient });
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
                    return Livelink.join({ session });
                case "join_or_start":
                    return Livelink.join_or_start({ scene_id, token, is_transient });
            }
        };

        connect()
            .then(instance => {
                // Allow the hook user to be notified of a disconnection occuring while the above operations run.
                // Still not perfect, because the gateway might disconnect before the instance is returned during
                // the GatewayController.authenticateClient or EditorController.connectToSession of livelink-core.
                // Also nothing's notify the livelink user of a loss of the EditorConnection.
                instance.session.addEventListener("on-disconnected", onDisconnectedHandler);

                console.log("Connected to Livelink", instance);
                configureClient(instance);
                setInstance(instance);
                instance.__setReadyCallback(async () => {
                    instance.startStreaming();
                    setIsConnecting(false);
                });
            })
            .catch(error => {
                console.error("Failed to connect to Livelink", error);
                setIsConnecting(false);
            });

        return () => {
            instance?.session.removeEventListener("on-disconnected", onDisconnectedHandler);
            setInstance(null);
        };
    }, [scene_id, session_id, token, is_transient, session_open_mode]);

    // Disconnect when unmounted
    useEffect(() => {
        return () => {
            instance?.disconnect();
        };
    }, [instance]);

    return (
        <LivelinkContext.Provider
            value={{
                instance,
                isConnecting,
                disconnect,
            }}
        >
            {isConnecting && loader}
            {isDisconnected && disconnectedModal}
            {children}
        </LivelinkContext.Provider>
    );
}

//------------------------------------------------------------------------------
function configureClient(instance: Livelink) {
    const configure = async () => {
        instance.session.removeEventListener("viewports-added", configure);

        console.log("-- Configuring client");
        const webcodec = await WebCodecsDecoder.findSupportedCodec();
        await instance.configureRemoteServer({ codec: webcodec || undefined });

        await instance.setEncodedFrameConsumer({
            encoded_frame_consumer:
                webcodec !== null
                    ? new WebCodecsDecoder(instance.default_decoded_frame_consumer)
                    : new SoftwareDecoder(instance.default_decoded_frame_consumer),
        });

        instance.__startIfReady();
    };

    instance.session.addEventListener("viewports-added", configure);
}

//------------------------------------------------------------------------------
export { LivelinkProvider as Livelink };

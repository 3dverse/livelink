//------------------------------------------------------------------------------
import React, { createContext, PropsWithChildren, ReactNode, useCallback, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import * as Livelink from "@3dverse/livelink";
import { Livelink as LivelinkInstance, type UUID } from "@3dverse/livelink";

/**
 * Context for managing the Livelink connection state.
 *
 * Provides information about the current Livelink instance, connection status,
 * and a method to disconnect from the Livelink service.
 */
export const LivelinkContext = createContext<{
    /** The current Livelink instance or `null` if not connected. */
    instance: LivelinkInstance | null;

    /** Indicates whether the connection is currently in progress. */
    isConnecting: boolean;

    /** Indicates whether the connection has been disconnected. */
    isDisconnected: boolean;

    /** Function to disconnect from the current Livelink session. */
    disconnect: () => void;
}>({
    instance: null,
    isConnecting: false,
    isDisconnected: false,
    disconnect: () => {},
});

/**
 * Represents the mode for joining an existing session.
 *
 * - `sessionOpenMode`: Must be `"join"`.
 * - `sessionId`: A valid UUID identifying the session to join.
 * - `sceneId`: Must be `undefined`.
 * - `isTransient`: Must be `undefined`.
 */
type SessionJoinMode = {
    sessionOpenMode: "join";
    sessionId: UUID;

    sceneId?: undefined;
    isTransient?: undefined;
};

/**
 * Represents the mode for either joining or starting a session.
 *
 * - `sessionOpenMode`: Optional, defaults to `"join-or-start"`.
 * - `sceneId`: A valid UUID identifying the scene to use when starting the session.
 * - `sessionId`: Must be `undefined`.
 * - `isTransient`: Specifies whether the opened session is transient (non-persistent).
 */
type SessionJoinOrStart = {
    sessionOpenMode?: "start" | "join-or-start";
    sceneId: UUID;
    isTransient?: boolean;

    sessionId?: undefined;
};

/**
 * Represents the union of all possible session open modes.
 *
 * This type includes:
 * - `SessionJoinMode`: For joining an existing session.
 * - `SessionJoinOrStart`: For joining or starting a session based on the provided context.
 */
export type SessionOpenMode = SessionJoinMode | SessionJoinOrStart;

/**
 * Parameters for establishing a Livelink connection.
 *
 * Extends `SessionOpenMode` to define the session behavior and includes additional
 * options for handling connection lifecycle events, UI components, and settings.
 */
export type LivelinkConnectParameters = {
    /**
     * Authentication token required to establish the connection.
     */
    token: string;

    /**
     * Optional callback triggered when the connection is disconnected.
     *
     * @param event - The event object containing details about the disconnection.
     */
    onDisconnected?: (event: Event) => void;

    /**
     * Optional React component or node displayed while the connection is loading.
     */
    loader?: ReactNode;

    /**
     * Optional React component or node displayed when an inactivity timeout occurs.
     */
    inactivityTimeoutModal?: ReactNode;

    /**
     * Optional React component or node displayed when the connection is disconnected.
     */
    connectionLostPanel?: ReactNode;
} & SessionOpenMode;

/**
 * Provides the Livelink context and manages the lifecycle of a Livelink connection.
 *
 * This component initializes and maintains a connection to the Livelink service
 * and supplies relevant connection state and methods to its children via context.
 *
 * @param props - The properties for configuring the Livelink connection and UI behavior.
 *
 * @property children - React children components that will have access to the Livelink context.
 * @property sceneId - The unique identifier of the scene to connect to (required for "start" or "join-or-start").
 * @property sessionId - The unique identifier of the session to join (required for "join").
 * @property isTransient - Specifies if the connection is transient (non-persistent).
 * @property token - The authentication token required for the Livelink connection.
 * @property loader - Optional React node displayed while the connection is being established.
 * @property onDisconnected - Optional callback invoked when the connection is disconnected.
 * @property inactivityTimeoutModal - Optional React node displayed when an inactivity timeout occurs.
 * @property disconnectedModal - Optional React node displayed when the connection is lost.
 * @property sessionOpenMode - Specifies the mode for opening the session; defaults to `"join-or-start"`.
 */
export function LivelinkProvider({
    children,
    sceneId,
    sessionId,
    isTransient,
    token,
    loader,
    onDisconnected,
    inactivityTimeoutModal,
    connectionLostPanel,
    sessionOpenMode = "join-or-start",
}: PropsWithChildren<LivelinkConnectParameters>) {
    const [instance, setInstance] = useState<LivelinkInstance | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isConnectionLost, setIsConnectionLost] = useState(false);

    const disconnect = useCallback(() => instance?.disconnect(), [instance]);

    useEffect(() => {
        const connect = async ({ sessionOpenMode, sceneId, sessionId }: SessionOpenMode) => {
            switch (sessionOpenMode) {
                case "start":
                    return LivelinkInstance.start({ scene_id: sceneId, token, is_transient: isTransient });
                case "join":
                    const session = await Livelink.Session.findById({ session_id: sessionId, token });
                    if (!session) {
                        throw new Error(`Session '${sessionId}' not found on scene '${sceneId}'`);
                    }
                    return LivelinkInstance.join({ session });
                case "join-or-start":
                    return LivelinkInstance.join_or_start({ scene_id: sceneId, token, is_transient: isTransient });
                default:
                    throw new Error("What are we doing here?!");
            }
        };

        connect({ sessionOpenMode, sceneId, sessionId } as SessionOpenMode)
            .then(instance => {
                console.debug("Connected to Livelink", instance);
                configureClient(instance);
                setInstance(instance);
                instance.__setReadyCallback(async () => {
                    instance.startStreaming();
                    setIsConnecting(false);
                });
            })
            .catch(error => {
                console.debug("Failed to connect to Livelink", error);
                setIsConnecting(false);
                setIsConnectionLost(true);
                onDisconnected?.(new CustomEvent("on-disconnected", { detail: error }));
            });

        return () => {
            setInstance(null);
            setIsConnecting(true);
            setIsConnectionLost(false);
        };
    }, [token, sessionOpenMode, sceneId, sessionId, isTransient]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        // Allow the hook user to be notified of a disconnection occuring while the above operations run.
        // Still not perfect, because the gateway might disconnect before the instance is returned during
        // the GatewayController.authenticateClient or EditorController.connectToSession of livelink-core.
        // Also nothing's notify the livelink user of a loss of the EditorConnection.

        const onDisconnectedHandler = (event: Event) => {
            setIsConnectionLost(true);
            onDisconnected?.(event);
        };

        instance.session.addEventListener("on-disconnected", onDisconnectedHandler);

        return () => {
            instance.session.removeEventListener("on-disconnected", onDisconnectedHandler);
        };
    }, [instance, onDisconnected]);

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
                isDisconnected: isConnectionLost,
                disconnect,
            }}
        >
            {isConnecting && loader}
            {isConnectionLost && connectionLostPanel}
            {children}
        </LivelinkContext.Provider>
    );
}

//------------------------------------------------------------------------------
function configureClient(instance: LivelinkInstance) {
    const configure = async () => {
        instance.session.removeEventListener("viewports-added", configure);

        console.log("-- Configuring client");
        const webcodec = await Livelink.WebCodecsDecoder.findSupportedCodec();
        await instance.configureRemoteServer({ codec: webcodec || undefined });

        await instance.setEncodedFrameConsumer({
            encoded_frame_consumer:
                webcodec !== null
                    ? new Livelink.WebCodecsDecoder(instance.default_decoded_frame_consumer)
                    : new Livelink.SoftwareDecoder(instance.default_decoded_frame_consumer),
        });

        instance.__startIfReady();
    };

    instance.session.addEventListener("viewports-added", configure);
}

//------------------------------------------------------------------------------
export { LivelinkProvider as Livelink };

//------------------------------------------------------------------------------
import React, { createContext, JSX, PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import * as Livelink from "@3dverse/livelink";
import { Livelink as LivelinkInstance, type UUID } from "@3dverse/livelink";
import { StrictUnion } from "../../utils";

/**
 * Context for managing the Livelink connection state.
 *
 * Provides information about the current Livelink instance, connection status,
 * and a method to disconnect from the Livelink service.
 *
 * @category Context Providers
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
 * @inline
 */
export type SessionJoinMode = {
    /**
     * The UUID of the session to join.
     */
    sessionId: UUID;
};

/**
 * Represents the mode for either joining or starting a session.
 *
 * - `sessionOpenMode`: Optional, defaults to `"join-or-start"`.
 * - `sceneId`: A valid UUID identifying the scene to use when starting the session.
 * - `sessionId`: Must be `undefined`.
 * - `isTransient`: Specifies whether the opened session is transient (non-persistent).
 *
 * @inline
 */
export type SessionJoinOrStart = {
    /**
     * The UUID of the scene to connect to or start a session on.
     */
    sceneId: UUID;

    /**
     * Whether to automatically join any existing session.
     */
    autoJoinExisting?: boolean;

    /**
     * If a new session is started, specifies whether it is transient (non-persistent).
     * If a session is joined, this property is ignored.
     */
    isTransient?: boolean;
};

/**
 * Represents the union of all possible session open modes.
 *
 * This type includes:
 * - `SessionJoinMode`: For joining an existing session.
 * - `SessionJoinOrStart`: For joining or starting a session based on the provided context.
 *
 * @inline
 */
export type SessionOpenMode = StrictUnion<SessionJoinMode | SessionJoinOrStart>;

/**
 * Parameters for establishing a Livelink connection.
 *
 * Extends `SessionOpenMode` to define the session behavior and includes additional
 * options for handling connection lifecycle events, UI components, and settings.
 *
 * @category Context Providers
 */
export type LivelinkConnectParameters = {
    /**
     * Authentication token required to establish the connection.
     */
    token: string;

    /**
     * Optional React component or node displayed while the connection is loading.
     */
    LoadingPanel?: React.ComponentType<{ stage: string }>;

    /**
     * Optional React component or node displayed when an inactivity timeout occurs.
     */
    InactivityWarningPanel?: React.ComponentType<{ warningDuration: number; onActivityDetected: () => void }>;

    /**
     * Optional React component or node displayed when the connection is disconnected.
     */
    ConnectionErrorPanel?: React.ComponentType<{ error: string }>;
} & SessionOpenMode;

/**
 * Connection promises map.
 *
 * To deal with React strict mode, and avoiding to create a session multiple times,
 * we need to keep track of the connection promises. The promises are stored
 * using the connection parameters as key.
 *
 * @internal
 */
type ConnectionPromisesMap = Map<string, Promise<Livelink.Livelink>>;

/**
 * Provides the Livelink context and manages the lifecycle of a Livelink connection.
 *
 * This component initializes and maintains a connection to the Livelink service
 * and supplies relevant connection state and methods to its children via context.
 *
 * @param params
 *
 * @param params.children - React children components that will have access to the Livelink context.
 * @param params.sceneId - The unique identifier of the scene to connect to (required for "start" or "join-or-start").
 * @param params.sessionId - The unique identifier of the session to join (required for "join").
 * @param params.isTransient - Specifies if the connection is transient (non-persistent).
 * @param params.token - The authentication token required for the Livelink connection.
 * @param params.LoadingPanel - Optional React node displayed while the connection is being established.
 * @param params.InactivityWarningPanel - Optional React node displayed when an inactivity timeout occurs.
 * @param params.ConnectionErrorPanel - Optional React node displayed when the connection is lost.
 * @param params.autoJoinExisting - Specifies the mode for opening the session; defaults to `"join-or-start"`.
 *
 * @category Context Providers
 */
export function LivelinkProvider({
    sceneId,
    sessionId,
    isTransient,
    token,
    LoadingPanel,
    InactivityWarningPanel,
    ConnectionErrorPanel,
    autoJoinExisting = true,
    children,
}: PropsWithChildren<LivelinkConnectParameters>): JSX.Element {
    const [instance, setInstance] = useState<LivelinkInstance | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isConnectionLost, setIsConnectionLost] = useState(false);
    const [inactivityWarning, setInactivityWarning] = useState<Livelink.InactivityWarningEvent | null>(null);
    const [connectionError, setConnectionError] = useState<string>("Unknown error");
    const connectionPromises = useRef<ConnectionPromisesMap>(new Map());

    const disconnect = useCallback(() => instance?.disconnect(), [instance]);

    useEffect(() => {
        const connect = async ({
            autoJoinExisting,
            sceneId,
            sessionId,
        }: SessionOpenMode): Promise<Livelink.Livelink> => {
            if (sessionId) {
                const session = await Livelink.Session.findById({ session_id: sessionId, token });
                if (!session) {
                    throw new Error(`Session '${sessionId}' not found on scene '${sceneId}'`);
                }
                return LivelinkInstance.join({ session });
            }

            if (sceneId) {
                if (autoJoinExisting) {
                    return LivelinkInstance.join_or_start({ scene_id: sceneId, token, is_transient: isTransient });
                } else {
                    return LivelinkInstance.start({ scene_id: sceneId, token, is_transient: isTransient });
                }
            }

            throw new Error("What are we doing here?!");
        };

        /**
         * To deal with React strict mode, and avoiding to create a session multiple times,
         * we need to keep track of the connection promises. The promises are stored
         * using the connection parameters as key.
         *
         * @returns The connection promise for the given parameters.
         */
        const getOrCreateConnectionPromise = (params: LivelinkConnectParameters): Promise<Livelink.Livelink> => {
            const key = getConnectionPromiseKey(params);
            let promise = connectionPromises.current.get(key);
            if (!promise) {
                promise = connect(params).then(instance => {
                    connectionPromises.current.delete(key);
                    return instance;
                });
                connectionPromises.current.set(key, promise);
            }
            return promise;
        };

        /**
         * Abort controller to avoid side effects when the component is unmounted.
         */
        const abort_controller = new AbortController();

        const onActivityDetected = (): void => {
            setInactivityWarning(null);
        };

        getOrCreateConnectionPromise({ autoJoinExisting, sceneId, sessionId, token } as LivelinkConnectParameters)
            .then(instance => {
                // if the component is unmounted, stop right here, and do not proceed with the connection
                if (abort_controller.signal.aborted) {
                    return;
                }

                console.debug("Connected to Livelink", instance);
                configureClient(instance);
                setInstance(instance);
                instance.TO_REMOVE__setReadyCallback(async () => {
                    instance.startStreaming();
                    setIsConnecting(false);
                });

                instance.session.addEventListener("on-inactivity-warning", setInactivityWarning);
                instance.session.addEventListener("on-activity-detected", onActivityDetected);
            })
            .catch(error => {
                console.debug("Failed to connect to Livelink", error);
                setIsConnecting(false);
                setIsConnectionLost(true);
                setConnectionError(error);
            });

        return (): void => {
            abort_controller.abort();

            instance?.session.removeEventListener("on-inactivity-warning", setInactivityWarning);
            instance?.session.removeEventListener("on-activity-detected", onActivityDetected);

            setInstance(null);
            setIsConnecting(true);
            setIsConnectionLost(false);
            setInactivityWarning(null);
        };
    }, [token, autoJoinExisting, sceneId, sessionId, isTransient]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        // Allow the hook user to be notified of a disconnection occuring while the above operations run.
        // Still not perfect, because the gateway might disconnect before the instance is returned during
        // the GatewayController.authenticateClient or EditorController.connectToSession of livelink-core.
        // Also nothing's notify the livelink user of a loss of the EditorConnection.

        const onDisconnectedHandler = (event: Livelink.DisconnectedEvent): void => {
            setIsConnectionLost(true);
            setInactivityWarning(null);
            setConnectionError(event.reason);
        };

        instance.session.addEventListener("on-disconnected", onDisconnectedHandler);

        return (): void => {
            instance.session.removeEventListener("on-disconnected", onDisconnectedHandler);
        };
    }, [instance]);

    // Disconnect when unmounted
    useEffect(() => {
        return (): void => {
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
            {isConnecting && LoadingPanel && <LoadingPanel stage={""} />}
            {isConnectionLost && ConnectionErrorPanel && <ConnectionErrorPanel error={connectionError} />}
            {inactivityWarning && InactivityWarningPanel && (
                <InactivityWarningPanel
                    warningDuration={inactivityWarning.seconds_remaining}
                    onActivityDetected={() => {
                        inactivityWarning.resetTimer();
                        setInactivityWarning(null);
                    }}
                />
            )}
            {children}
        </LivelinkContext.Provider>
    );
}

//------------------------------------------------------------------------------
function configureClient(instance: LivelinkInstance): void {
    const configure = async (): Promise<void> => {
        instance.session.removeEventListener("TO_REMOVE__viewports-added", configure);

        console.debug("-- Configuring client");
        const webcodec = await Livelink.WebCodecsDecoder.findSupportedCodec();
        await instance.configureRemoteServer({ codec: webcodec || undefined });

        await instance.setEncodedFrameConsumer({
            encoded_frame_consumer:
                webcodec !== null
                    ? new Livelink.WebCodecsDecoder({ decoded_frame_consumer: instance.default_decoded_frame_consumer })
                    : new Livelink.SoftwareDecoder({ decoded_frame_consumer: instance.default_decoded_frame_consumer }),
        });

        instance.TO_REMOVE__startIfReady();
    };

    instance.session.addEventListener("TO_REMOVE__viewports-added", configure);
}

//------------------------------------------------------------------------------
function getConnectionPromiseKey(params: LivelinkConnectParameters): string {
    return JSON.stringify(params);
}

//------------------------------------------------------------------------------
export { LivelinkProvider as Livelink };

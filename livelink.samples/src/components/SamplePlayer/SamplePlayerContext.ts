//------------------------------------------------------------------------------
import { createContext } from "react";

//------------------------------------------------------------------------------
export type ConnectionState = "disconnected" | "connected" | "connection-lost" | "reconnect";

//------------------------------------------------------------------------------
export const SamplePlayerContext = createContext<{
    connectionState: ConnectionState;
    setConnectionState: ((state: ConnectionState) => void) | null;
}>({
    connectionState: "disconnected",
    setConnectionState: null,
});

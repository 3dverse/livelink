import { createContext, useEffect, useState } from "react";
import { CanvasActionBar } from "./CanvasActionBar";

type ConnectionState = "disconnected" | "connected" | "connection-lost" | "reconnect";

//------------------------------------------------------------------------------
export const SamplePlayerContext = createContext<{
    connectionState: ConnectionState;
    setConnectionState: ((state: ConnectionState) => void) | null;
}>({
    connectionState: "disconnected",
    setConnectionState: null,
});

//------------------------------------------------------------------------------
export function SamplePlayer({ children }: React.PropsWithChildren) {
    const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

    useEffect(() => {
        if (connectionState === "reconnect") {
            setConnectionState("connected");
        }
    }, [connectionState]);

    const mountChildren = connectionState !== "disconnected" && connectionState !== "reconnect";
    const mountActionBar = connectionState !== "connection-lost";
    const centerActionBar = connectionState === "disconnected";

    return (
        <SamplePlayerContext.Provider value={{ connectionState, setConnectionState }}>
            <div className="w-full h-full flex gap-3 p-3 lg:pl-0 relative">
                {mountChildren && children}
                {mountActionBar && (
                    <CanvasActionBar isCentered={centerActionBar}>
                        <button
                            className="button button-primary"
                            onClick={() =>
                                setConnectionState(connectionState === "connected" ? "disconnected" : "connected")
                            }
                        >
                            {connectionState === "connected" ? "Disconnect" : "Connect"}
                        </button>
                    </CanvasActionBar>
                )}
            </div>
        </SamplePlayerContext.Provider>
    );
}

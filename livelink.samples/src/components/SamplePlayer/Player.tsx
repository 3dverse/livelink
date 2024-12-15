import { createContext, useEffect, useState } from "react";
import { CanvasActionBar } from "./CanvasActionBar";
import Markdown from "react-markdown";

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
export function SamplePlayer({ readme, children }: React.PropsWithChildren<{ readme?: string }>) {
    const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

    useEffect(() => {
        if (connectionState === "reconnect") {
            setConnectionState("connected");
        }
    }, [connectionState]);

    const mountChildren = connectionState !== "disconnected" && connectionState !== "reconnect";
    const mountActionBar = connectionState !== "connection-lost";
    const centerActionBar = connectionState === "disconnected";

    const toggleConnectionState = () =>
        setConnectionState(connectionState === "connected" ? "disconnected" : "connected");

    const connectButton = (
        <button onClick={toggleConnectionState}>
            <svg
                version="1.1"
                id="play"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                x="0px"
                y="0px"
                height="100px"
                width="100px"
                viewBox="0 0 100 100"
                enable-background="new 0 0 100 100"
                xmlSpace="preserve"
            >
                <path
                    className="stroke-solid"
                    fill="none"
                    stroke="#ddbe72"
                    d="M49.9,2.5C23.6,2.8,2.1,24.4,2.5,50.4C2.9,76.5,24.7,98,50.3,97.5c26.4-0.6,47.4-21.8,47.2-47.7
    C97.3,23.7,75.7,2.3,49.9,2.5"
                />
                <path
                    className="icon"
                    fill="#ddbe72"
                    d="M38,69c-1,0.5-1.8,0-1.8-1.1V32.1c0-1.1,0.8-1.6,1.8-1.1l34,18c1,0.5,1,1.4,0,1.9L38,69z"
                />
            </svg>
        </button>
    );

    const disconnectButton = (
        <button
            className={connectionState === "connected" ? "button button-primary" : ""}
            onClick={toggleConnectionState}
        >
            Disconnect
        </button>
    );

    return (
        <SamplePlayerContext.Provider value={{ connectionState, setConnectionState }}>
            <div className="w-full h-full flex gap-3 p-3 lg:pl-0 relative">
                <div className="w-full h-full gap-3 bg-[#1e222e] rounded-xl relative flex">
                    {mountChildren && children}
                    {mountActionBar && (
                        <>
                            <CanvasActionBar isCentered={centerActionBar}>
                                {connectionState === "connected" ? disconnectButton : connectButton}
                            </CanvasActionBar>
                            {readme && (
                                <div>
                                    <Markdown>{readme}</Markdown>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </SamplePlayerContext.Provider>
    );
}

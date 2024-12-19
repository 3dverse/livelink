import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { ActionBar } from "./ActionBar";
import Markdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus as codeTheme } from "react-syntax-highlighter/dist/esm/styles/prism";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";

//------------------------------------------------------------------------------
SyntaxHighlighter.registerLanguage("tsx", tsx);

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

//------------------------------------------------------------------------------
export function SamplePlayer({
    title,
    summary,
    description,
    code,
    useCustomLayout = false,
    autoConnect = true,
    children,
}: PropsWithChildren<{
    title?: string;
    summary?: string;
    description?: string;
    code?: string;
    useCustomLayout?: boolean;
    autoConnect?: boolean;
}>) {
    const [connectionState, setConnectionState] = useState<ConnectionState>(autoConnect ? "connected" : "disconnected");

    useEffect(() => {
        if (connectionState === "reconnect") {
            setConnectionState("connected");
        }
    }, [connectionState]);

    const mountChildren = connectionState === "connected" || connectionState === "connection-lost";
    const mountActionBar = connectionState === "connected";
    const mountPlayButton = connectionState === "disconnected";

    const connectButton = (
        <button onClick={() => setConnectionState("connected")} className="relative w-32 h-32 m-auto flex">
            <svg
                version="1.1"
                id="play"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                x="0px"
                y="0px"
                viewBox="0 0 100 100"
                enableBackground="new 0 0 100 100"
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

    return (
        <SamplePlayerContext.Provider value={{ connectionState, setConnectionState }}>
            <div className="w-full h-full flex gap-3 p-3 lg:pl-0 relative">
                <div className="w-full h-full gap-3 bg-[#1e222e] rounded-xl relative flex">
                    {useCustomLayout ? (
                        children
                    ) : (
                        <>
                            {mountChildren && children}
                            {mountPlayButton && (
                                <div className="w-full h-full flex-col content-center justify-center">
                                    {connectButton}
                                    <h1 className="text-center font-medium">{title}</h1>
                                    <h2 className="text-center font-extralight">{summary}</h2>
                                </div>
                            )}
                            {mountActionBar && <ActionBar disconnect={() => setConnectionState("disconnected")} />}
                        </>
                    )}
                </div>
            </div>

            {description && (
                <div>
                    <Markdown>{description}</Markdown>
                </div>
            )}

            {code === "caca" && (
                <SyntaxHighlighter language="jsx" style={codeTheme} className="absolute bottom-0 right-0 max-h-[150px]">
                    {code}
                </SyntaxHighlighter>
            )}
        </SamplePlayerContext.Provider>
    );
}

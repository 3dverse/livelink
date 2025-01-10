import { createContext, PropsWithChildren, useEffect, useState } from "react";
import Markdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl as codeTheme } from "react-syntax-highlighter/dist/esm/styles/prism";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import { ActionBar } from "./ActionBar";
import { CopyCodeButton } from "./CopyCodeButton";

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
    const [showCode, setShowCode] = useState(true);

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
            <div className="w-full h-full flex flex-col-reverse xl:flex-row gap-3 p-3 lg:pl-0 relative">
                {code && showCode && (
                    <article className="relative max-h-[50%] xl:max-h-none max-w-[40ch] md:max-w-[50ch] bg-overground rounded-xl overflow-y-clip">
                        <header className="flex justify-between gap-3 px-3 py-3 border-b border-quaternary">
                            <p className="text-xs text-tertiary">{title}</p>
                            <div className="flex items-center gap-2">
                                <CopyCodeButton code={code} />
                                <button className="button button-outline button-2xs" onClick={() => setShowCode(false)}>
                                    Hide
                                </button>
                            </div>
                        </header>
                        <SyntaxHighlighter
                            language="jsx"
                            style={codeTheme}
                            className="h-full !m-0 !bg-transparent !text-[.8em] "
                        >
                            {code}
                        </SyntaxHighlighter>
                    </article>
                )}
                <div className="grow h-full gap-3 bg-[#1e222e] rounded-xl relative flex overflow-clip">
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
                {description && (
                    <div>
                        <Markdown>{description}</Markdown>
                    </div>
                )}
            </div>
        </SamplePlayerContext.Provider>
    );
}

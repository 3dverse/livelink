import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl as codeTheme } from "react-syntax-highlighter/dist/esm/styles/prism";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import { CopyCodeButton } from "./CopyCodeButton";
import { CollapseIcon } from "../icons/CollapseIcon";
import { LOCAL_STORAGE_KEYS, useLocalStorage } from "../../lib/localStorage";

//------------------------------------------------------------------------------
SyntaxHighlighter.registerLanguage("tsx", tsx);

//------------------------------------------------------------------------------
export function CodeBlock({ code, title }: { code: string; title?: string }) {
    const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.IS_CODE_BLOCK_COLLAPSED, false);

    return (
        <>
            {isCollapsed ? (
                <button
                    className="relative w-full xl:w-10 h-10 xl:h-full bg-overground rounded-xl xl:[writing-mode:vertical-rl] text-sm text-tertiary hover:text-secondary transition-colors tracking-wide"
                    onClick={() => setIsCollapsed(false)}
                >
                    <span className="absolute top-3 right-4 xl:top-5 xl:right-4">
                        <CollapseIcon className="w-3 h-3 rotate-90 xl:rotate-0" />
                    </span>
                    Code
                </button>
            ) : (
                <article className="relative flex flex-col max-h-[50%] xl:max-h-none xl:max-w-[50ch] bg-overground rounded-xl overflow-y-clip">
                    <header className="flex justify-between gap-3 px-3 py-3 border-b border-quaternary">
                        {title ? <p className="text-xs text-tertiary">{title}</p> : <div />}
                        <div className="flex items-center gap-2">
                            <CopyCodeButton code={code} />
                            <button className="button button-icon" onClick={() => setIsCollapsed(true)}>
                                <CollapseIcon className="w-3 h-3 -rotate-90 xl:rotate-180" />
                            </button>
                        </div>
                    </header>
                    <SyntaxHighlighter
                        language="jsx"
                        style={codeTheme}
                        className="h-full !m-0 !bg-transparent !text-[.8em] !px-0"
                        showLineNumbers
                    >
                        {code}
                    </SyntaxHighlighter>
                </article>
            )}
        </>
    );
}

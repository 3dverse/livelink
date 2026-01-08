import { Highlight, themes } from "prism-react-renderer";
import { CopyCodeButton } from "./CopyCodeButton";
import { GitHubIcon } from "../icons/GitHubIcon";
import { CollapseIcon } from "../icons/CollapseIcon";
import { LOCAL_STORAGE_KEYS, useLocalStorage } from "../../lib/localStorage";

//------------------------------------------------------------------------------
export function CodeBlock({ code, title, gitPath }: { code: string; title?: string; gitPath?: string }) {
    const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.IS_CODE_BLOCK_COLLAPSED, false);

    return (
        <>
            {isCollapsed ? (
                <button
                    className="relative w-full xl:w-10 h-10 xl:h-full bg-foreground rounded-xl xl:[writing-mode:vertical-rl] text-sm tracking-wide text-tertiary hover:text-secondary transition-colors cursor-pointer"
                    onClick={() => setIsCollapsed(false)}
                >
                    <span className="absolute top-3 right-4 xl:top-4">
                        <CollapseIcon className="w-3 h-3 rotate-90 xl:rotate-0" />
                    </span>
                    Code
                </button>
            ) : (
                <article className="relative flex flex-col max-h-[50%] xl:max-h-none xl:max-w-[50ch] 2xl:max-w-[60ch] 3xl:max-w-[70ch] 4xl:max-w-[85ch] bg-foreground rounded-xl overflow-y-clip">
                    <header className="flex justify-between items-center gap-3 px-3 py-3 border-b border-quaternary">
                        {title ? <p className="text-xs text-tertiary">{title}</p> : <div />}
                        <div className="flex items-center gap-2">
                            <CopyCodeButton code={code} />
                            {gitPath && (
                                <a
                                    href={gitPath}
                                    className="button button-outline button-xs"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <GitHubIcon className="w-3 h-3" />
                                    <span className="ml-2 hidden md:inline">
                                        <span className="hidden xl:inline">View on </span>GitHub
                                    </span>
                                </a>
                            )}
                            <button className="button button-icon button-xs" onClick={() => setIsCollapsed(true)}>
                                <CollapseIcon className="w-3 h-3 -rotate-90 xl:rotate-180" />
                            </button>
                        </div>
                    </header>
                    <Highlight theme={themes.nightOwl} code={code} language="tsx">
                        {({ style, tokens, getLineProps, getTokenProps }) => (
                            <pre
                                className="h-full text-[.8em] !m-0 !bg-transparent !py-[1em] overflow-auto"
                                style={style}
                            >
                                {tokens.map((line, i) => (
                                    <div key={i} {...getLineProps({ line })}>
                                        <span className="text-right select-none italic pr-[1em] text-[#637777] inline-block min-w-[3.25em]">
                                            {i + 1}
                                        </span>
                                        {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                    </div>
                                ))}
                            </pre>
                        )}
                    </Highlight>
                </article>
            )}
        </>
    );
}

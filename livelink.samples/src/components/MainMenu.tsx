import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { SAMPLES } from "../samples/index.ts";
import { resolveSamplePath } from "./SamplePlayer/index.tsx";
import { BarsIcon } from "./icons/BarsIcon.tsx";
import { CollapseIcon } from "./icons/CollapseIcon.tsx";
import { LOCAL_STORAGE_KEYS, useLocalStorage } from "../lib/localStorage.ts";

//------------------------------------------------------------------------------
const BREAKPOINT_LG = 991;
const EMBEDDED_PAGE_QUERY = "embedded";

//------------------------------------------------------------------------------
export function MainMenu() {
    const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.IS_MAIN_MENU_COLLAPSED, false);
    const [isScreenLargerThanLG, setIsScreenLargerThanLG] = useState<boolean>();
    const [isPageEmbedded, setIsPageEmbedded] = useState<boolean>(false);

    const onCollapse = () => {
        setIsCollapsed(true);
    };

    useEffect(() => {
        const handleResize = () => {
            setIsScreenLargerThanLG(window.innerWidth > BREAKPOINT_LG);
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Hide 3dverse logo for Documentation Samples pages:
    // https://docs.3dverse.com/samples
    useEffect(() => {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const _isPageEmbedded = ["true", "1"].includes(params.get(EMBEDDED_PAGE_QUERY) || "");

        if (_isPageEmbedded) {
            setIsPageEmbedded(true);
        }
    }, []);

    //--------------------------------------------------------------------------
    return (
        <>
            {/* Toggle button */}
            {isCollapsed && (
                <button
                    className="button button-outline button-icon absolute top-4 left-4 bg-underground text-primary animate-appear-right z-10"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <BarsIcon className="w-5 h-5" />
                </button>
            )}

            {/* Overlay */}
            <div
                className={`
                    z-20 lg:hidden absolute top-0 left-0 w-screen h-full bg-underground transition-opacity opacity-0 cursor-pointer
                    ${isCollapsed ? "pointer-events-none" : "opacity-70"}
                `}
                onClick={onCollapse}
            />

            {/* Menu */}

            <nav
                className={`absolute xl:relative top-0 transition-all h-screen overflow-x-hidden ${isCollapsed ? "w-0 xl:w-3" : "w-80"}`}
            >
                <div
                    className="absolute w-80 h-full flex flex-col bg-ground shadow-2xl lg:shadow-none z-20"
                    onClick={isScreenLargerThanLG ? undefined : onCollapse}
                >
                    <header className={`flex justify-between mt-6 mb-4 pr-1 ${isPageEmbedded ? "pl-3" : "pl-5"}`}>
                        <NavLink
                            to="/"
                            className="flex items-start gap-3 pl-3 font-primary text-secondary text-[1.1rem] tracking-wider"
                        >
                            {!isPageEmbedded && (
                                <img
                                    src="https://3dverse.com/logo/3dverse-wordmark.svg"
                                    className="h-4 mt-[3px]"
                                    alt="3dverse"
                                />
                            )}
                            Samples
                        </NavLink>
                        <button className="button button-icon" onClick={onCollapse}>
                            <CollapseIcon className="w-3 h-3" />
                        </button>
                    </header>

                    <ul
                        className={`
                            flex flex-col gap-6 h-full pb-16 text-secondary overflow-y-auto
                            ${isPageEmbedded ? "px-3" : "px-5"}
                        `}
                    >
                        {SAMPLES.map((category, i) => (
                            <li key={i}>
                                <p className="mb-1 pl-3 text-2xs uppercase text-tertiary tracking-wider opacity-80">
                                    {category.categoryName}
                                </p>
                                {category.list.map((s, y) => (
                                    <NavLink
                                        key={y}
                                        to={resolveSamplePath(s.path)}
                                        className={({ isActive }) =>
                                            [
                                                "button button-ghost py-[3px] text-xs justify-start rounded-xl",
                                                isActive ? "active" : "",
                                            ].join(" ")
                                        }
                                    >
                                        {s.title}
                                    </NavLink>
                                ))}
                            </li>
                        ))}
                    </ul>
                </div>
            </nav>
        </>
    );
}

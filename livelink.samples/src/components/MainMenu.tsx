import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";

import { Logo3dverse } from "@3dverse/design-tokens";

import samples from "../samples";

import { LOCAL_STORAGE_KEYS, useLocalStorage } from "../lib/localStorage";
import { resolveSamplePath } from "./SamplePlayer/index";
import { BarsIcon } from "./icons/BarsIcon";
import { CollapseIcon } from "./icons/CollapseIcon";
import { ScrollableArea } from "./common/ScrollableArea";

//------------------------------------------------------------------------------
const BREAKPOINT_LG = 991;

//------------------------------------------------------------------------------
export function MainMenu({ isPageEmbedded }: { isPageEmbedded?: boolean }) {
    const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.IS_MAIN_MENU_COLLAPSED, false);
    const [isScreenLargerThanLG, setIsScreenLargerThanLG] = useState<boolean>();
    const scrollContainerRef = useRef<HTMLDivElement>(null!);

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

    // Auto-scroll to active NavLink
    useEffect(() => {
        if (scrollContainerRef.current) {
            const activeNavLink = scrollContainerRef.current.querySelector(".active");
            if (activeNavLink) {
                activeNavLink.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            }
        }
    }, []);

    //--------------------------------------------------------------------------
    return (
        <>
            {/* Toggle button */}
            {isCollapsed && (
                <button
                    className="button button-icon absolute top-0 left-0 bg-underground text-primary p-3 animate-appear-right z-100"
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
                className={`absolute xl:relative top-0 transition-all h-dvh overflow-x-hidden z-100 ${isCollapsed ? "w-0 xl:w-3" : "w-80"}`}
            >
                <div
                    className="absolute w-80 h-full flex flex-col bg-ground/85 xl:bg-ground border-r border-tertiary xl:border-none rounded-e-xl xl:rounded-none backdrop-blur-xl xl:backdrop-blur-none shadow-2xl lg:shadow-none z-20"
                    onClick={isScreenLargerThanLG ? undefined : onCollapse}
                >
                    <header className={`flex justify-between mt-6 mb-4 pr-1 ${isPageEmbedded ? "pl-3" : "pl-5"}`}>
                        <NavLink
                            to="/"
                            className="flex items-start gap-3 pl-3 font-primary text-secondary text-[1.1rem] tracking-wider"
                        >
                            {!isPageEmbedded && <Logo3dverse className="h-4 mt-[5px]" />}
                            Samples
                        </NavLink>
                        <button className="button button-icon button-xs text-tertiary mr-3" onClick={onCollapse}>
                            <CollapseIcon className="w-3 h-3" />
                        </button>
                    </header>

                    <ScrollableArea ref={scrollContainerRef} className="overflow-y-auto">
                        <ul className={`flex flex-col gap-6  pb-16 text-secondary ${isPageEmbedded ? "px-3" : "px-5"}`}>
                            {samples.map((category, i) => (
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
                                                    "button button-ghost px-3 py-[3px] text-xs leading-normal justify-start rounded-lg",
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
                    </ScrollableArea>
                </div>
            </nav>
        </>
    );
}

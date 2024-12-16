//------------------------------------------------------------------------------
import { NavLink } from "react-router-dom";
import { SAMPLES } from "../samples/react-core/index.tsx";
import { resolveSamplePath } from "./SamplePlayer/index.tsx";

//------------------------------------------------------------------------------
export function MainMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <div>
            {isOpen && (
                <div
                    className={`
                         z-20 lg:hidden absolute top-0 left-0 w-screen h-full bg-underground transition-opacity opacity-0 cursor-pointer
                        ${isOpen ? "opacity-80" : ""}
                    `}
                    onClick={onClose}
                />
            )}

            <nav
                className={`absolute lg:relative top-0 transition-transform h-screen ${isOpen ? "" : "-translate-x-full lg:translate-x-0"}`}
            >
                <div
                    className="relative w-80 h-full flex flex-col bg-ground shadow-2xl lg:shadow-none z-20"
                    onClick={onClose}
                >
                    <header className="mt-6 mb-3 px-5">
                        <NavLink to="/" className="flex items-center gap-3 pl-3 font-primary text-lg">
                            <img src="https://console.3dverse.com/static/logo/3dverse-wordmark.svg" className="h-6" />
                            3dverse Samples
                        </NavLink>
                    </header>
                    <ul className="flex flex-col gap-6 h-full px-5 py-4 text-secondary overflow-auto">
                        {SAMPLES.map((category, i) => (
                            <li key={i}>
                                <p className="mb-1 pl-4 text-2xs uppercase text-tertiary opacity-80 tracking-wider">
                                    {category.categoryName}
                                </p>
                                {category.list.map((s, y) => (
                                    <NavLink
                                        key={y}
                                        to={resolveSamplePath(s.path)}
                                        className={({ isActive }) =>
                                            [
                                                "button button-ghost py-1 text-sm justify-start rounded-xl",
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
        </div>
    );
}

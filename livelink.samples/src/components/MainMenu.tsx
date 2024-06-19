//------------------------------------------------------------------------------
import { NavLink } from "react-router-dom";
import { SAMPLES } from "../samples";

//------------------------------------------------------------------------------
export function MainMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <div>
            {isOpen && (
                <div
                    className={`
                        lg:hidden absolute top-0 left-0 w-screen h-full bg-underground transition-opacity opacity-0 cursor-pointer z-10
                        ${isOpen ? "opacity-80" : ""}
                    `}
                    onClick={onClose}
                />
            )}

            <nav
                className={`absolute lg:relative top-0 transition-transform h-screen ${isOpen ? "" : "-translate-x-full lg:translate-x-0"}`}
            >
                <div
                    className="relative w-80 h-full flex flex-col bg-ground shadow-2xl lg:shadow-none z-10"
                    onClick={onClose}
                >
                    <header className="my-6 px-5">
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
                                        to={s.path}
                                        className={({ isActive }) =>
                                            [
                                                "button button-ghost text-sm justify-start rounded-xl",
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

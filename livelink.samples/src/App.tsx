//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { NavLink, Outlet, useOutlet } from "react-router-dom";
import { SAMPLES } from "./samples";
import { Home } from "./components/Home";
import { BarsIcon } from "./components-system/common/icons/BarsIcon";

//------------------------------------------------------------------------------
function App() {
    //------------------------------------------------------------------------------
    const outlet = useOutlet();
    const [isNavOpen, setnavOpen] = useState(true);

    //------------------------------------------------------------------------------
    useEffect(() => {
        const handleResize = () => {
            setnavOpen(window.innerWidth > 1200);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    //------------------------------------------------------------------------------
    return (
        <div className="flex h-screen">
            <div>
                {isNavOpen && (
                    <div
                        className={`lg:hidden absolute top-0 left-0 w-screen h-full bg-color-underground transition-opacity opacity-0 cursor-pointer z-10 ${isNavOpen ? "opacity-80" : ""}`}
                        onClick={() => setnavOpen(false)}
                    />
                )}
                <nav
                    className={`absolute lg:relative top-0 transition-transform h-screen ${isNavOpen ? "" : "-translate-x-full lg:translate-x-0"}`}
                >
                    <div
                        className="relative bg-color-ground w-80 h-full px-5 py-4 shadow-2xl lg:shadow-none z-10"
                        onClick={() => setnavOpen(false)}
                    >
                        <header className="mt-1 mb-6">
                            <NavLink to="/" className="flex items-center gap-3 pl-3 font-primary text-lg">
                                <img
                                    src="https://console.3dverse.com/static/logo/3dverse-wordmark.svg"
                                    className="h-6"
                                />
                                3dverse Samples
                            </NavLink>
                        </header>
                        <ul className="flex flex-col gap-6 h-full text-color-secondary">
                            {SAMPLES.map((category, i) => (
                                <li key={i}>
                                    <p className="mb-1 pl-4 text-2xs uppercase text-color-tertiary opacity-80 tracking-wider">
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
            <div className="grow">
                {outlet ? <Outlet /> : <Home />}
                <button
                    className="button button-icon lg:hidden absolute top-4 left-5"
                    onClick={() => setnavOpen(!isNavOpen)}
                >
                    <BarsIcon />
                </button>
            </div>
        </div>
    );
}

export default App;

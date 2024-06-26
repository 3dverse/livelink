//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Outlet, useOutlet } from "react-router-dom";

import { Home } from "./components/Home";
import { BarsIcon } from "./components-system/common/icons/BarsIcon";
import { MainMenu } from "./components/MainMenu";

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
            <MainMenu isOpen={isNavOpen} onClose={() => setnavOpen(false)} />
            <div className="grow">
                {outlet ? <Outlet /> : <Home />}
                <button
                    className="lg:hidden button button-outline button-icon absolute top-5 left-5 text-primary"
                    onClick={() => setnavOpen(!isNavOpen)}
                >
                    <BarsIcon />
                </button>
            </div>
        </div>
    );
}

export default App;

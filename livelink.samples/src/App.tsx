//------------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Outlet, useOutlet } from "react-router-dom";

import { Home } from "./components/Home";
import { BarsIcon } from "./components-system/common/icons/BarsIcon";
import { MainMenu } from "./components/MainMenu";
import { Livelink } from "@3dverse/livelink";

// Use prod API and editor-backend on CI/CD or if VITE_TEST_PROD_ENV is set in .env.local
const useProdEnv = import.meta.env.PROD || import.meta.env.VITE_TEST_PROD_ENV == "true";
// @ts-ignore
Livelink._api_url = useProdEnv ? "https://api.3dverse.com/app/v1" : "https://api.3dverse.dev/app/v1";
// @ts-ignore
Livelink._editor_url = useProdEnv ? "wss://api.3dverse.com/editor-backend" : "wss://api.3dverse.dev/editor-backend";

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
            <MainMenu useProdEnv={useProdEnv} isOpen={isNavOpen} onClose={() => setnavOpen(false)} />
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

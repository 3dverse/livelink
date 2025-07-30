//------------------------------------------------------------------------------
import { useMemo } from "react";
import { Outlet, useOutlet } from "react-router";

import { Home } from "./components/Home";
import { MainMenu } from "./components/MainMenu";

//import { Livelink } from "@3dverse/livelink"
//Livelink._api_url = "https://api.3dverse.dev/app/v1";

//------------------------------------------------------------------------------
const EMBEDDED_PAGE_QUERY = "embedded";

//------------------------------------------------------------------------------
function App() {
    //--------------------------------------------------------------------------
    const outlet = useOutlet();
    const isPageEmbedded = useMemo(() => {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const embeddedPage = params.get(EMBEDDED_PAGE_QUERY);
        return embeddedPage === "true" || embeddedPage === "1";
    }, []);

    //--------------------------------------------------------------------------
    return (
        <div className="flex h-dvh">
            <MainMenu isPageEmbedded={isPageEmbedded} />
            <div className="flex-1 max-w-[100vw]">{outlet ? <Outlet /> : <Home />}</div>
        </div>
    );
}

export default App;

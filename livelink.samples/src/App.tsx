//------------------------------------------------------------------------------
import { Outlet, useOutlet } from "react-router";
import { Home } from "./components/Home";
import { MainMenu } from "./components/MainMenu";

//import { Livelink } from "@3dverse/livelink"
//Livelink._api_url =  "https://api.3dverse.dev/app/v1";
//Livelink._editor_url = "wss://api.3dverse.dev/editor-backend";

//------------------------------------------------------------------------------
function App() {
    //------------------------------------------------------------------------------
    const outlet = useOutlet();

    //------------------------------------------------------------------------------
    return (
        <div className="flex h-screen">
            <MainMenu />
            <div className="flex-1 max-w-[100vw]">{outlet ? <Outlet /> : <Home />}</div>
        </div>
    );
}

export default App;

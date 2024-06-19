//------------------------------------------------------------------------------
import { NavLink } from "react-router-dom";

//------------------------------------------------------------------------------
export function Home() {
    return (
        <div className="h-full border-l border-tertiary">
            <div className="container-lg flex flex-col items-center justify-center h-full w-full py-12">
                <h1 className="font-primary text-5xl">3dverse samples</h1>
                <p className="mt-1 text-lg text-tertiary">Explore 3dverse features by examples.</p>
                <NavLink to="/simple-canvas" className="button button-primary mt-10">
                    Start with the Simple Canvas
                </NavLink>
            </div>
        </div>
    );
}

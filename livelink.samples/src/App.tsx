import { NavLink, Outlet, useOutlet } from "react-router-dom";
import { SAMPLES } from "./samples";

function App() {
    const outlet = useOutlet();

    return (
        <div className="drawer lg:drawer-open">
            <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content flex flex-col items-center justify-center">
                {outlet ? <Outlet /> : <p>Choose a sample</p>}
                <label htmlFor="my-drawer-2" className="btn btn-primary drawer-button lg:hidden">
                    Open drawer
                </label>
            </div>
            <div className="drawer-side">
                <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay"></label>
                <ul className="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
                    <li key={"HOME"}>
                        <NavLink to={"/"}>Home</NavLink>{" "}
                    </li>
                    {SAMPLES.map((s, i) => (
                        <li key={i}>
                            <NavLink to={s.path}>{s.title}</NavLink>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default App;

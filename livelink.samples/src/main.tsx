import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import ErrorPage from "./ErrorPage.tsx";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "./styles/index.css";
import { RouterProvider, createHashRouter } from "react-router-dom";
import { SAMPLES } from "./samples";

const router = createHashRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <ErrorPage />,
        children: SAMPLES.flatMap(({ list }) => list).map(sample => ({ path: sample.path, element: sample.element })),
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

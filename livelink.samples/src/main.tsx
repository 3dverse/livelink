import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import ErrorPage from "./ErrorPage.tsx";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "./styles/index.css";
import { RouterProvider, createHashRouter } from "react-router-dom";
import { SAMPLES } from "./samples/index.ts";
import { SamplePlayer } from "./components/SamplePlayer/SamplePlayer.tsx";
import { resolveSamplePath } from "./components/SamplePlayer/index.tsx";

const router = createHashRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <ErrorPage />,
        children: SAMPLES.flatMap(({ list }) => list).map(sample => ({
            path: resolveSamplePath(sample.path),
            element: (
                <SamplePlayer
                    key={sample.path}
                    title={sample.title}
                    summary={sample.summary}
                    description={sample.description}
                    useCustomLayout={sample.useCustomLayout}
                    autoConnect={sample.autoConnect}
                    code={sample.code}
                >
                    {sample.element}
                </SamplePlayer>
            ),
        })),
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

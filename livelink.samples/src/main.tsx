import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter } from "react-router";

import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "./styles/index.css";

import App from "./App";
import ErrorPage from "./ErrorPage";
import samples from "./samples";

import { SamplePlayer } from "./components/SamplePlayer/SamplePlayer";
import { resolveSamplePath } from "./components/SamplePlayer";

// This allow to augment the global scope of vite with new properties
declare global {
    interface ImportMeta {
        /**
         * Current source file name.
         */
        readonly VITE_FILE_NAME: string;

        /**
         * Current source file content without transpilation.
         */
        readonly VITE_FILE_CONTENT: string;
    }
}

const router = createHashRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <ErrorPage />,
        children: samples
            .flatMap(({ list }) => list)
            .map(sample => ({
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

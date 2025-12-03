import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouteObject, RouterProvider, createHashRouter } from "react-router";

import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";

import "./styles/index.css";

import App from "./App";
import ErrorPage from "./ErrorPage";
import samples from "./samples";

import { SamplePlayer } from "./components/SamplePlayer/SamplePlayer";
import { resolveGitPath, resolveSamplePath } from "./components/SamplePlayer";

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

const sampleList = samples.flatMap(({ list }) => list);

const route: RouteObject = {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: sampleList.map(sample => {
        return {
            path: resolveSamplePath(sample.path),
            element: (
                <SamplePlayer
                    key={sample.path}
                    title={sample.title}
                    gitPath={resolveGitPath(sample.path)}
                    path={resolveSamplePath(sample.path)}
                    summary={sample.summary}
                    description={sample.description}
                    useCustomLayout={sample.useCustomLayout}
                    autoConnect={sample.autoConnect}
                    code={sample.code}
                >
                    <sample.component />
                </SamplePlayer>
            ),
        };
    }),
};

const standaloneSamplesRoute: RouteObject = {
    path: "/standalone",
    children: sampleList.map(sample => ({
        path: resolveSamplePath(sample.path),
        element: (
            <div className="flex h-dvh">
                <sample.component />
            </div>
        ),
    })),
};

if (route.children) {
    route.children.unshift({
        index: true,
        element: <Navigate to={route.children[0].path!} replace />,
    });
}

const router = createHashRouter([route, standaloneSamplesRoute]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
);

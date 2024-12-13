import SingleCanvasSingleViewport from "./viewports/1-single-canvas-single-viewport";
import SingleCanvasDoubleViewports from "./viewports/2-single-canvas-double-viewports";
import DoubleCanvasSingleViewport from "./viewports/3-double-canvas-single-viewport";
import DoubleCanvasDoubleViewports from "./viewports/4-double-canvas-double-viewports";
import CanvasInCanvas from "./viewports/5-canvas-in-canvas";
import ViewportInViewport from "./viewports/6-viewport-in-viewport";

import SceneSelector from "./sessions/1-scene-selector";
import MultiSession from "./sessions/2-multi-session";
import LinkedMultiSession from "./sessions/3-linked-multi-session";

export const SAMPLES: Array<{
    categoryName: string;
    list: Array<{ prod?: boolean; title: string; path: string; element: JSX.Element }>;
}> = [
    {
        categoryName: "Viewports",
        list: [
            {
                title: "Single Canvas Single Viewport",
                path: "single-canvas-single-viewport",
                element: <SingleCanvasSingleViewport />,
            },
            {
                title: "Single Canvas Double Viewports",
                path: "single-canvas-double-viewports",
                element: <SingleCanvasDoubleViewports />,
            },
            {
                title: "Double Canvas Single Viewport",
                path: "double-canvas-single-viewport",
                element: <DoubleCanvasSingleViewport />,
            },
            {
                title: "Double Canvas Double Viewports",
                path: "double-canvas-double-viewports",
                element: <DoubleCanvasDoubleViewports />,
            },
            {
                title: "Canvas in Canvas",
                path: "canvas-in-canvas",
                element: <CanvasInCanvas />,
            },
            {
                title: "Viewport in Viewport",
                path: "viewport-in-viewport",
                element: <ViewportInViewport />,
            },
        ],
    },
    {
        categoryName: "Sessions",
        list: [
            {
                title: "Scene Selector",
                path: "scene-selector",
                element: <SceneSelector />,
            },
            {
                title: "Multi Session",
                path: "multi-session",
                element: <MultiSession />,
            },

            {
                title: "Linked Multi Session",
                path: "linked-multi-session",
                element: <LinkedMultiSession />,
            },
        ],
    },
];

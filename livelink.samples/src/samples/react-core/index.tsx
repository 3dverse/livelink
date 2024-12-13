import SingleCanvasSingleViewport from "./viewports/1-single-canvas-single-viewport";
import SingleCanvasDoubleViewports from "./viewports/2-single-canvas-double-viewports";
import DoubleCanvasSingleViewport from "./viewports/3-double-canvas-single-viewport";
import DoubleCanvasDoubleViewports from "./viewports/4-double-canvas-double-viewports";
import CanvasInCanvas from "./viewports/5-canvas-in-canvas";
import ViewportInViewport from "./viewports/6-viewport-in-viewport";

export const SAMPLES: Array<{
    categoryName: string;
    list: Array<{ prod?: boolean; title: string; path: string; element: JSX.Element }>;
}> = [
    {
        categoryName: "Viewports",
        list: [
            {
                title: "Single Canvas Single Viewport",
                path: "1-single-canvas-single-viewport",
                element: <SingleCanvasSingleViewport />,
            },
            {
                title: "Single Canvas Double Viewports",
                path: "2-single-canvas-double-viewports",
                element: <SingleCanvasDoubleViewports />,
            },
            {
                title: "Double Canvas Single Viewport",
                path: "3-double-canvas-single-viewport",
                element: <DoubleCanvasSingleViewport />,
            },
            {
                title: "Double Canvas Double Viewports",
                path: "4-double-canvas-double-viewports",
                element: <DoubleCanvasDoubleViewports />,
            },
            {
                title: "Canvas in Canvas",
                path: "5-canvas-in-canvas",
                element: <CanvasInCanvas />,
            },
            {
                title: "Viewport in Viewport",
                path: "6-viewport-in-viewport",
                element: <ViewportInViewport />,
            },
        ],
    },
];

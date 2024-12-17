//------------------------------------------------------------------------------
import SingleCanvasSingleViewport from "./1-viewports/1-single-canvas-single-viewport";
import SingleCanvasDoubleViewports from "./1-viewports/2-single-canvas-double-viewports";
import DoubleCanvasSingleViewport from "./1-viewports/3-double-canvas-single-viewport";
import DoubleCanvasDoubleViewports from "./1-viewports/4-double-canvas-double-viewports";
import CanvasInCanvas from "./1-viewports/5-canvas-in-canvas";
import ViewportInViewport from "./1-viewports/6-viewport-in-viewport";

//------------------------------------------------------------------------------
import SceneSelector from "./3-sessions/1-scene-selector";
import MultiSession from "./3-sessions/2-multi-session";
import LinkedMultiSession from "./3-sessions/3-linked-multi-session";
import Clients from "./3-sessions/4-clients";
import Collaborators from "./3-sessions/5-collaborators-avatars";

//------------------------------------------------------------------------------
import DOM3DOverlayViewport from "./2-overlays/1-dom-3d-overlay";
import ThreeOverlayViewport from "./2-overlays/2-threejs-overlay";
import MultiOverlayViewport from "./2-overlays/3-multi-overlay";
import ThirdPersonController from "./cameras/third-person-controller/ThirdPersonController";

//------------------------------------------------------------------------------
export const SAMPLES: Array<{
    categoryName: string;
    list: Array<{
        path: string;
        title: string;
        summary?: string;
        description?: string;
        element: JSX.Element;
    }>;
}> = [
    {
        categoryName: "Viewports",
        list: [
            SingleCanvasSingleViewport,
            SingleCanvasDoubleViewports,
            DoubleCanvasSingleViewport,
            DoubleCanvasDoubleViewports,
            CanvasInCanvas,
            ViewportInViewport,
        ],
    },
    {
        categoryName: "Overlays",
        list: [DOM3DOverlayViewport, ThreeOverlayViewport, MultiOverlayViewport],
    },
    {
        categoryName: "Sessions",
        list: [
            Clients,
            Collaborators,
            /*
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
            */
        ],
    },
    {
        categoryName: "Cameras",
        list: [ThirdPersonController],
    },
];

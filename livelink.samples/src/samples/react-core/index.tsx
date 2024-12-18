//------------------------------------------------------------------------------
import SingleCanvasSingleViewport from "./1-viewports/1-single-canvas-single-viewport";
import SingleCanvasDoubleViewports from "./1-viewports/2-single-canvas-double-viewports";
import DoubleCanvasSingleViewport from "./1-viewports/3-double-canvas-single-viewport";
import DoubleCanvasDoubleViewports from "./1-viewports/4-double-canvas-double-viewports";
import CanvasInCanvas from "./1-viewports/5-canvas-in-canvas";
import ViewportInViewport from "./1-viewports/6-viewport-in-viewport";

//------------------------------------------------------------------------------
import SceneSelector from "./2-sessions/1-scene-selector";
import MultiSession from "./2-sessions/2-multi-session";
import LinkedMultiSession from "./2-sessions/3-linked-multi-session";

//------------------------------------------------------------------------------
import DOM3DOverlayViewport from "./3-overlays/1-dom-3d-overlay";
import ThreeOverlayViewport from "./3-overlays/2-threejs-overlay";
import MultiOverlayViewport from "./3-overlays/3-multi-overlay";

//------------------------------------------------------------------------------
import DefaultCameraController from "./4-cameras/1-default-camera-controller";
import CustomCameraController from "./4-cameras/2-custom-camera-controller";
import ThirdPersonController from "./4-cameras/x-third-person-controller";

//------------------------------------------------------------------------------
import Clients from "./5-clients/1-clients-list";
import Collaborators from "./5-clients/2-clients-avatars";

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
        list: [DefaultCameraController, CustomCameraController, ThirdPersonController],
    },
];

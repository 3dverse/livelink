// Core
import SimpleCanvas from "./simple-canvas/SimpleCanvas";
import DoubleCanvas from "./double-canvas/DoubleCanvas";
import QuadrupleCanvas from "./quadruple-canvas/QuadrupleCanvas";
import MultiSession from "./multi-session/MultiSession";
import SceneSelector from "./scene-selector/SceneSelector";

// Smart Object
import SmartObjectSync from "./smart-object-sync/SmartObjectSync";
import SmartObject from "./smart-object/SmartObject";

// Control
import Trigger from "./trigger/Trigger";
import ControllerEffects from "./controller-effects/ControllerEffects";
import ThirdPersonController from "./third-person-controller/ThirdPersonController";
import PointAndClick from "./point-and-click/PointAndClick";
import HighlightEntities from "./highlight-entities/HighlightEntities";

// Factory
import ConveyorBelt from "./conveyor-belt/ConveyorBelt";
import ConveyorBeltSorting from "./conveyor-belt-sorting/ConveyorBeltSorting";
import LabelingStation from "./labeling-station/LabelingStation";

// WebXR
import WebXR from "./web-xr/WebXR";
import MultiViewportCanvas from "./multi-viewport-canvas/MultiViewportCanvas";

// Misc
import Collaborators from "./collaborators/Collaborators";
import ActivityWatcher from "./activity-watcher/ActivityWatcher";
import PictureInPicture from "./picture-in-picture/PictureInPicture";
import LiveSkeletalAnimation from "./live-skeletal-animation/LiveSkeletalAnimation";
import RenderTargetDebug from "./render-target-debug/RenderTargetDebug";
import VideoCapture from "./video-capture/VideoCapture";
import ThreeJS from "./threejs/ThreeJS";
import DOMOverlaySample from "./dom-overlay/DOMOverlaySample";

export const SAMPLES: Array<{
    categoryName: string;
    list: Array<{ prod?: boolean; title: string; path: string; element: JSX.Element }>;
}> = [
    {
        categoryName: "Core",
        list: [
            { title: "Simple Canvas", path: "simple-canvas", element: <SimpleCanvas />, prod: true },
            { title: "Double Canvas", path: "double-canvas", element: <DoubleCanvas /> },
            { title: "Multi-Viewport Canvas", path: "multi-viewport-canvas", element: <MultiViewportCanvas /> },
            { title: "Quadruple Canvas", path: "quadruple-canvas", element: <QuadrupleCanvas /> },
            { title: "Multi-Session", path: "multi-session", element: <MultiSession /> },
            { title: "Scene Selector", path: "scene-selector", element: <SceneSelector /> },
        ],
    },
    {
        categoryName: "Smart Object",
        list: [
            { title: "Smart Object", path: "smart-object", element: <SmartObject /> },
            { title: "Smart Object Sync", path: "smart-object-sync", element: <SmartObjectSync /> },
        ],
    },
    {
        categoryName: "Control",
        list: [
            { title: "Trigger", path: "trigger", element: <Trigger /> },
            { title: "Controller Effects", path: "controller-effects", element: <ControllerEffects /> },
            {
                prod: true,
                title: "Third Person Controller",
                path: "third-person-controller",
                element: <ThirdPersonController />,
            },
            { title: "Point and Click", path: "point-and-click", element: <PointAndClick /> },
            { title: "Highlight Entities", path: "highlight", element: <HighlightEntities /> },
        ],
    },
    {
        categoryName: "Factory",
        list: [
            { title: "Conveyor Belt", path: "conveyor-belt", element: <ConveyorBelt /> },
            { title: "Sorting Station", path: "conveyor-belt-sorting", element: <ConveyorBeltSorting /> },
            { title: "Labeling Station", path: "labeling-station", element: <LabelingStation /> },
        ],
    },
    {
        categoryName: "Overlays",
        list: [
            { title: "ThreeJS", path: "threejs", element: <ThreeJS /> },
            { title: "DOM", path: "dom", element: <DOMOverlaySample /> },
            { title: "Collaborators", path: "collaborators", element: <Collaborators />, prod: true },
        ],
    },
    {
        categoryName: "WebXR",
        list: [
            { title: "Immersive AR Session", path: "webxr-ar", element: <WebXR key="ar" mode="immersive-ar" /> },
            { title: "Immersive VR Session", path: "webxr-vr", element: <WebXR key="vr" mode="immersive-vr" /> },
        ],
    },
    {
        categoryName: "Misc",
        list: [
            { title: "Activity Watcher", path: "activity-watcher", element: <ActivityWatcher /> },
            { title: "Picture in Picture", path: "picture-in-picture", element: <PictureInPicture /> },
            { title: "Live Skeletal Animation", path: "live-skeletal-animation", element: <LiveSkeletalAnimation /> },
            { title: "Render Target Debug", path: "render-target-debug", element: <RenderTargetDebug /> },
            { title: "Video Capture", path: "video-capture", element: <VideoCapture /> },
        ],
    },
];

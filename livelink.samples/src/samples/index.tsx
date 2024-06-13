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

// Factory
import ConveyorBelt from "./conveyor-belt/ConveyorBelt";
import ConveyorBeltSorting from "./conveyor-belt-sorting/ConveyorBeltSorting";
import LabelingStation from "./labeling-station/LabelingStation";

// Misc
import Collaborators from "./collaborators/Collaborators";
import PictureInPicture from "./picture-in-picture/PictureInPicture";

export const SAMPLES = [
    {
        categoryName: "Core",
        list: [
            { title: "Simple Canvas", path: "simple-canvas", element: <SimpleCanvas /> },
            { title: "Double Canvas", path: "double-canvas", element: <DoubleCanvas /> },
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
            { title: "Third Person Controller", path: "third-person-controller", element: <ThirdPersonController /> },
            { title: "Point and Click", path: "point-and-click", element: <PointAndClick /> },
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
        categoryName: "Misc",
        list: [
            { title: "Collaborators", path: "collaborators", element: <Collaborators /> },
            { title: "Picture in Picture", path: "picture-in-picture", element: <PictureInPicture /> },
        ],
    },
];

import Collaborators from "./collaborators/Collaborators";
import ControllerEffects from "./controller-effects/ControllerEffects";
import ConveyorBeltSorting from "./conveyor-belt-sorting/ConveyorBeltSorting";
import ConveyorBelt from "./conveyor-belt/ConveyorBelt";
import DoubleCanvas from "./double-canvas/DoubleCanvas";
import FirstPersonController from "./first-person-controller/FirstPersonController";
import MultiSession from "./multi-session/MultiSession";
import PictureInPicture from "./picture-in-picture/PictureInPicture";
import QuadrupleCanvas from "./quadruple-canvas/QuadrupleCanvas";
import SceneSelector from "./scene-selector/SceneSelector";
import SimpleCanvas from "./simple-canvas/SimpleCanvas";
import SmartObjectSync from "./smart-object-sync/SmartObjectSync";
import SmartObject from "./smart-object/SmartObject";
import Trigger from "./trigger/Trigger";

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
            { title: "Conveyor Belt", path: "conveyor-belt", element: <ConveyorBelt /> },
            { title: "Conveyor Belt Sorting", path: "conveyor-belt-sorting", element: <ConveyorBeltSorting /> },
            { title: "First Person Controller", path: "first-person-controller", element: <FirstPersonController /> },
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

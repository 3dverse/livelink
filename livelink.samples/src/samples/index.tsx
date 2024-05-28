import DoubleCanvas from "./double-canvas/DoubleCanvas";
import MultiSession from "./multi-session/MultiSession";
import QuadrupleCanvas from "./quadruple-canvas/QuadrupleCanvas";
import SceneSelector from "./scene-selector/SceneSelector";
import SimpleCanvas from "./simple-canvas/SimpleCanvas";
import SmartObjectSync from "./smart-object-sync/SmartObjectSync";
import SmartObject from "./smart-object/SmartObject";
import Trigger from "./trigger/Trigger";

export const SAMPLES = [
    { title: "Simple Canvas", path: "simple-canvas", element: <SimpleCanvas /> },
    { title: "Double Canvas", path: "double-canvas", element: <DoubleCanvas /> },
    { title: "Quadruple Canvas", path: "quadruple-canvas", element: <QuadrupleCanvas /> },
    { title: "Multi-Session", path: "multi-session", element: <MultiSession /> },
    { title: "Smart Object", path: "smart-object", element: <SmartObject /> },
    { title: "Scene Selector", path: "scene-selector", element: <SceneSelector /> },
    { title: "Smart Object Sync", path: "smart-object-sync", element: <SmartObjectSync /> },
    { title: "Trigger", path: "trigger", element: <Trigger /> },
];

//------------------------------------------------------------------------------
import type { ReactElement } from "react";

//------------------------------------------------------------------------------
import SingleCanvasSingleViewport from "./react-core/1-viewports/1-single-canvas-single-viewport";
import SingleCanvasDoubleViewports from "./react-core/1-viewports/2-single-canvas-double-viewports";
import DoubleCanvasSingleViewport from "./react-core/1-viewports/3-double-canvas-single-viewport";
import DoubleCanvasDoubleViewports from "./react-core/1-viewports/4-double-canvas-double-viewports";
import CanvasInCanvas from "./react-core/1-viewports/5-canvas-in-canvas";
import ViewportInViewport from "./react-core/1-viewports/6-viewport-in-viewport";
import ViewportRenderTarget from "./react-core/1-viewports/7-viewport-render-target";

//------------------------------------------------------------------------------
import SceneSelector from "./react-core/2-sessions/1-scene-selector";
import MultiSession from "./react-core/2-sessions/2-multi-session";
import JoinSession from "./react-core/2-sessions/3-join-session";

//------------------------------------------------------------------------------
import DOM3DOverlayViewport from "./react-core/3-overlays/1-dom-3d-overlay";
import ThreeOverlayViewport from "./react-core/3-overlays/2-threejs-overlay";
import MultiOverlayViewport from "./react-core/3-overlays/3-multi-overlay";
import DOM3DElementAnchors from "./react-core/3-overlays/4-dom-element-anchors";

//------------------------------------------------------------------------------
import DefaultCameraControllers from "./react-core/4-cameras/1-default-camera-controllers";
import CustomCameraController from "./react-core/4-cameras/2-custom-camera-controller";
import ThirdPersonController from "./react-core/4-cameras/3-third-person-controller";
import CameraRenderTarget from "./react-core/4-cameras/4-camera-render-target";
import CameraTravel from "./react-core/4-cameras/5-camera-travel";

//------------------------------------------------------------------------------
import Clients from "./react-core/5-clients/1-clients-list";
import Collaborators from "./react-core/5-clients/2-clients-avatars";

//------------------------------------------------------------------------------
import CreateEntity from "./react-core/6-entities/1-create-entity";
import EntityPicking from "./react-core/6-entities/2-entity-picking";
import FindingEntities from "./react-core/6-entities/3-finding-entities";
import SmartObject from "./react-core/6-entities/4-smart-object";
import Environments from "./react-core/6-entities/5-environments";
import EntityVisibility from "./react-core/6-entities/6-entity-visibility";

//------------------------------------------------------------------------------
import ActivityWatcher from "./react-ui/1-activity-watcher";
import SunPositionPicker from "./react-ui/2-sun-position-picker";
import RenderGraphSettings from "./react-ui/3-render-graph-settings";
import ViewCube from "./react-ui/4-view-cube";
import LightControl from "./react-ui/5-light-control";
import CameraSpeedSlider from "./react-ui/6-camera-speed-slider";
import PerformancePanel from "./react-ui/7-performance-panel";
import CullingBoxGeometry from "./react-ui/8-culling-box-geometry";

//------------------------------------------------------------------------------
import LiveSkeletalAnimation from "./advanced/x-live-skeletal-animation";
import WebXR from "./advanced/x-web-xr";
import WebXRiOS from "./advanced/x-web-xr-ios";
import MPR from "./advanced/x-multiplanar-reconstruction";
import ThreeTransformControls from "./advanced/x-three-transform-controls";
import ScriptEvents from "./advanced/x-script-events";
import Recording from "./advanced/x-recording";
import Audio from "./advanced/x-audio";
import Material from "./advanced/x-material";
import HeadlessClient from "./advanced/x-headless-client";

//------------------------------------------------------------------------------
type SampleCategory = {
    categoryName: string;
    list: Array<Sample>;
};

//------------------------------------------------------------------------------
type Sample = {
    path: string;
    title: string;
    summary?: string;
    description?: string;
    useCustomLayout?: boolean;
    autoConnect?: boolean;
    element: ReactElement;
    code?: string;
};

//------------------------------------------------------------------------------
export default [
    {
        categoryName: "Viewports",
        list: [
            SingleCanvasSingleViewport,
            SingleCanvasDoubleViewports,
            DoubleCanvasSingleViewport,
            DoubleCanvasDoubleViewports,
            CanvasInCanvas,
            ViewportInViewport,
            ViewportRenderTarget,
        ],
    },
    {
        categoryName: "Sessions",
        list: [SceneSelector, MultiSession, JoinSession],
    },
    {
        categoryName: "Overlays",
        list: [DOM3DOverlayViewport, ThreeOverlayViewport, MultiOverlayViewport, DOM3DElementAnchors],
    },
    {
        categoryName: "Cameras",
        list: [
            DefaultCameraControllers,
            CustomCameraController,
            ThirdPersonController,
            CameraRenderTarget,
            CameraTravel,
        ],
    },
    {
        categoryName: "Clients",
        list: [Clients, Collaborators],
    },
    {
        categoryName: "Entities",
        list: [CreateEntity, EntityPicking, FindingEntities, SmartObject, Environments, EntityVisibility],
    },
    {
        categoryName: "Widgets",
        list: [
            ActivityWatcher,
            SunPositionPicker,
            RenderGraphSettings,
            ViewCube,
            LightControl,
            CameraSpeedSlider,
            PerformancePanel,
            CullingBoxGeometry,
        ],
    },
    {
        categoryName: "Advanced",
        list: [
            LiveSkeletalAnimation,
            WebXR,
            WebXRiOS,
            MPR,
            ThreeTransformControls,
            ScriptEvents,
            Recording,
            Audio,
            Material,
            HeadlessClient,
        ],
    },
] as Array<SampleCategory>;

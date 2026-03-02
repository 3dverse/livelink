//------------------------------------------------------------------------------
import type { JSX } from "react";

//------------------------------------------------------------------------------
import SingleCanvasSingleViewport from "./react-core/1-viewports/1-single-canvas-single-viewport/manifest";
import SingleCanvasDoubleViewports from "./react-core/1-viewports/2-single-canvas-double-viewports/manifest";
import DoubleCanvasSingleViewport from "./react-core/1-viewports/3-double-canvas-single-viewport/manifest";
import DoubleCanvasDoubleViewports from "./react-core/1-viewports/4-double-canvas-double-viewports/manifest";
import CanvasInCanvas from "./react-core/1-viewports/5-canvas-in-canvas/manifest";
import ViewportInViewport from "./react-core/1-viewports/6-viewport-in-viewport/manifest";
import ViewportRenderTarget from "./react-core/1-viewports/7-viewport-render-target/manifest";
import ScaleCanvas from "./react-core/1-viewports/8-scale-canvas/manifest";

//------------------------------------------------------------------------------
import SceneSelector from "./react-core/2-sessions/1-scene-selector/manifest";
import MultiSession from "./react-core/2-sessions/2-multi-session/manifest";
import JoinSession from "./react-core/2-sessions/3-join-session/manifest";

//------------------------------------------------------------------------------
import DOM3DOverlayViewport from "./react-core/3-overlays/1-dom-3d-overlay/manifest";
import ThreeOverlayViewport from "./react-core/3-overlays/2-threejs-overlay/manifest";
import MultiOverlayViewport from "./react-core/3-overlays/3-multi-overlay/manifest";
import DOM3DAnchorOffsets from "./react-core/3-overlays/4-dom-anchor-offsets/manifest";

//------------------------------------------------------------------------------
import DefaultCameraControllers from "./react-core/4-cameras/1-default-camera-controllers/manifest";
import CustomCameraController from "./react-core/4-cameras/2-custom-camera-controller/manifest";
import ThirdPersonController from "./react-core/4-cameras/3-third-person-controller/manifest";
import CameraRenderTarget from "./react-core/4-cameras/4-camera-render-target/manifest";
import CameraTravel from "./react-core/4-cameras/5-camera-travel/manifest";

//------------------------------------------------------------------------------
import Clients from "./react-core/5-clients/1-clients-list/manifest";
import Collaborators from "./react-core/5-clients/2-clients-avatars/manifest";

//------------------------------------------------------------------------------
import CreateEntity from "./react-core/6-entities/1-create-entity/manifest";
import EntityPicking from "./react-core/6-entities/2-entity-picking/manifest";
import FindingEntities from "./react-core/6-entities/3-finding-entities/manifest";
import SmartObject from "./react-core/6-entities/4-smart-object/manifest";
import Environments from "./react-core/6-entities/5-environments/manifest";
import EntityVisibility from "./react-core/6-entities/6-entity-visibility/manifest";
import SceneSettings from "./react-core/6-entities/7-settings/manifest";

//------------------------------------------------------------------------------
import ActivityWatcher from "./react-ui/1-activity-watcher/manifest";
import SunPositionPicker from "./react-ui/2-sun-position-picker/manifest";
import RenderGraphSettings from "./react-ui/3-render-graph-settings/manifest";
import ViewCube from "./react-ui/4-view-cube/manifest";
import LightControl from "./react-ui/5-light-control/manifest";
import CameraSpeedSlider from "./react-ui/6-camera-speed-slider/manifest";
import PerformancePanel from "./react-ui/7-performance-panel/manifest";
import CullingBoxGeometry from "./react-ui/8-culling-box-geometry/manifest";
import VideoRecorder from "./react-ui/9-video-recorder/manifest";
import BoundingBoxFaceProjection from "./react-ui/10-bounding-box-face-projection/manifest";

//------------------------------------------------------------------------------
import LiveSkeletalAnimation from "./advanced/x-live-skeletal-animation/manifest";
import WebXR from "./advanced/x-web-xr/manifest";
import WebXRiOS from "./advanced/x-web-xr-ios/manifest";
import MPR from "./advanced/x-multiplanar-reconstruction/manifest";
import ThreeTransformControls from "./advanced/x-three-transform-controls/manifest";
import ScriptEvents from "./advanced/x-script-events/manifest";
import Audio from "./advanced/x-audio/manifest";
import Material from "./advanced/x-material/manifest";
import HeadlessClient from "./advanced/x-headless-client/manifest";

//------------------------------------------------------------------------------
type SampleCategory = {
    categoryName: string;
    list: Array<Sample>;
};

//------------------------------------------------------------------------------
export type SampleMetadata = {
    title: string;
    summary?: string;
    description?: string;
    useCustomLayout?: boolean;
    autoConnect?: boolean;
};

//------------------------------------------------------------------------------
export type Sample = SampleMetadata & {
    path: string;
    component: () => JSX.Element;
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
            ScaleCanvas,
        ],
    },
    {
        categoryName: "Sessions",
        list: [SceneSelector, MultiSession, JoinSession],
    },
    {
        categoryName: "Overlays",
        list: [DOM3DOverlayViewport, ThreeOverlayViewport, MultiOverlayViewport, DOM3DAnchorOffsets],
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
        list: [
            CreateEntity,
            EntityPicking,
            FindingEntities,
            SmartObject,
            Environments,
            EntityVisibility,
            SceneSettings,
        ],
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
            VideoRecorder,
            BoundingBoxFaceProjection,
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
            Audio,
            Material,
            HeadlessClient,
        ],
    },
] as Array<SampleCategory>;

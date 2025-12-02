export type * from "@3dverse/livelink.core";

export * from "./Livelink";
export * from "./EditionEvent";

export * from "./session/Client";
export * from "./session/Session";
export * from "./session/ClientInfo";
export * from "./session/SessionInfo";
export * from "./session/SessionEvents";

export * from "./scene/Scene";
export * from "./scene/Entity";
export * from "./scene/SceneEvents";
export * from "./scene/EntityEvents";
export * from "./scene/ScriptEvents";

export * from "./rendering/camera/Viewport";
export * from "./rendering/camera/ViewportEvents";
export * from "./rendering/camera/CameraController";
export * from "./rendering/camera/CameraControllerPreset";
export * as CameraControllerPresets from "./rendering/camera/CameraControllerPresets";
export * from "./rendering/camera/CameraProjection";

export * from "./rendering/streaming/FrameMetaData";
export * from "./rendering/streaming/SoftwareDecoder";
export * from "./rendering/streaming/WebCodecsDecoder";
export * from "./rendering/streaming/EncodedFrameConsumer";
export * from "./rendering/streaming/DecodedFrameConsumer";

export * from "./rendering/contexts/Context2D";
export * from "./rendering/contexts/ContextWebGL";
export * from "./rendering/contexts/ContextProvider";

export * from "./rendering/surfaces/Rect";
export * from "./rendering/surfaces/VirtualSurface";
export * from "./rendering/surfaces/RenderingSurface";
export * from "./rendering/surfaces/OffscreenSurface";
export * from "./rendering/surfaces/OverlayInterface";
export * from "./rendering/surfaces/RenderingSurfaceBase";
export * from "./rendering/surfaces/RenderingSurfaceEvents";

export * from "./inputs/Mouse";
export * from "./inputs/Keyboard";
export * from "./inputs/GamepadsRegistry";
export * from "./inputs/GamepadInputRelay";

export type { Transform, Aabb } from "./scene/EntityTransformHandler";

export * as Maths from "threejs-math";

//------------------------------------------------------------------------------
declare global {
    interface Window {
        __LIVELINK__: Record<string, string>;
    }
}

if (typeof window !== "undefined") {
    if (!window.__LIVELINK__) {
        window.__LIVELINK__ = {};
    }

    if (Object.prototype.hasOwnProperty.call(window.__LIVELINK__, PACKAGE_NAME)) {
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink being imported.");
    } else {
        window.__LIVELINK__[PACKAGE_NAME] = LIVELINK_VERSION;
    }
}

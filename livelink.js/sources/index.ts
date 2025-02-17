export type * from "@3dverse/livelink.core";

export * from "./Livelink";

export * from "./session/Client";
export * from "./session/Session";
export * from "./session/ClientInfo";
export * from "./session/SessionInfo";
export * from "./session/SessionEvents";

export * from "./scene/Scene";
export * from "./scene/Entity";
export * from "./scene/EntityEvents";
export * from "./scene/ScriptEvents";

export * from "./rendering/Viewport";
export * from "./rendering/ViewportEvents";
export * from "./rendering/CameraController";
export * from "./rendering/CameraControllerPreset";
export * as CameraControllerPresets from "./rendering/CameraControllerPresets";
export * from "./rendering/CameraProjection";

export * from "./rendering/decoders/FrameMetaData";
export * from "./rendering/decoders/SoftwareDecoder";
export * from "./rendering/decoders/WebCodecsDecoder";
export * from "./rendering/decoders/EncodedFrameConsumer";
export * from "./rendering/decoders/DecodedFrameConsumer";

export * from "./rendering/contexts/XRContext";
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
export * from "./inputs/Gamepad";
export * from "./inputs/Keyboard";

export type { Transform } from "./scene/EntityTransformHandler";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink library, injected by the build system.
 * @internal
 */
declare const LIVELINK_VERSION: string;

/**
 * Name of the package, injected by the build system.
 * @internal
 */
declare const PACKAGE_NAME: string;

//------------------------------------------------------------------------------
declare global {
    interface Window {
        __LIVELINK__: Record<string, string>;
    }
}

//------------------------------------------------------------------------------
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

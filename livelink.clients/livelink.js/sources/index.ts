export type * from "@3dverse/livelink.core";

// Shared headless base modules re-exported as-is. The modules the browser SDK overrides (Livelink,
// Session, SessionEvents, Entity, Scene, SceneEvents) are *not* star re-exported: only their
// non-overridden siblings are picked out by name below, so the shadowed base symbols never reach
// the public surface — a base flavour published next to the browser one it exists to back would be
// pure noise in the documentation.
export * from "@livelink.base/EditionEvent";
export type { LivelinkConnectionStage, LivelinkProgressCallback } from "@livelink.base/LivelinkBase";
export * from "@livelink.base/session/ClientInfo";
export * from "@livelink.base/session/SessionInfo";
export * from "@livelink.base/scene/EntityRegistry";
export * from "@livelink.base/scene/EntityEvents";
export * from "@livelink.base/scene/ScriptEvents";
export * from "./Livelink";

// The browser SDK ships its own Client subclass (resolving entities as the proxied browser Entity).
export { Client, type CursorData } from "./session/Client";

// The browser SDK ships its own Session subclass (adding client metadata updates).
export type { SessionSelector } from "@livelink.base/session/Session";
export { Session } from "./session/Session";

// The browser SDK augments the shared session event map (deprecated viewport event) and rebinds the
// client lifecycle events to the browser Client; the explicit re-exports override the SessionEvents.
export { ActivityDetectedEvent, DisconnectedEvent, InactivityWarningEvent } from "@livelink.base/session/SessionEvents";
export { TO_REMOVE__ViewportsAddedEvent, ClientJoinedEvent, ClientLeftEvent } from "./session/SessionEvents";
export type { SessionEvents } from "./session/SessionEvents";

// The browser SDK ships its own proxied entity & scene, overriding the headless.
export { Entity, type Transform, type Aabb } from "./scene/Entity";

// The browser SDK augments the shared scene event map (proxied-Entity event payloads).
export { EntitiesDeletedEvent, SceneSettingsUpdatedEvent } from "@livelink.base/scene/SceneEvents";
export { EntitiesCreatedEvent } from "./scene/SceneEvents";
export type { SceneEvents } from "./scene/SceneEvents";
export type { EntityCreationOptions, SceneInfo } from "@livelink.base/scene/Scene";
export { EntityComponentsProxy } from "../_prebuild/EntityComponentsProxy";
export { Scene } from "./scene/Scene";

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

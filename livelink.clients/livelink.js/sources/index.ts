export type * from "@3dverse/livelink.core";

// Shared headless base modules re-exported as-is. The four modules the browser SDK overrides
// (Session, SessionEvents, Entity, Scene) are still star re-exported here so their non-overridden
// siblings stay public; the explicit re-exports below shadow the overridden names. The shadowed
// base symbols are re-exported under *Base* alias names so they keep a public (and
// documented, linkable) identity.
export * from "@livelink.base/EditionEvent";
export * from "@livelink.base/LivelinkInstance";
export * from "@livelink.base/LivelinkBase";
export * from "@livelink.base/TypedEventTarget";
export * from "@livelink.base/session/Client";
export * from "@livelink.base/session/ClientInfo";
export * from "@livelink.base/session/SessionInfo";
export * from "@livelink.base/session/Session";
export * from "@livelink.base/session/SessionEvents";
export * from "@livelink.base/scene/Scene";
export * from "@livelink.base/scene/Entity";
export * from "@livelink.base/scene/EntityRegistry";
export * from "@livelink.base/scene/EntityEvents";
export * from "@livelink.base/scene/SceneEvents";
export * from "@livelink.base/scene/ScriptEvents";
export { EntityComponents } from "@livelink.base/_prebuild/EntityComponents";

export * from "./Livelink";

// The browser SDK ships its own Client subclass (resolving entities as the proxied browser
// Entity), overriding the headless one re-exported from the shared base above.
export { Client, type CursorData } from "./session/Client";
export { Client as ClientBase } from "@livelink.base/session/Client";

// The browser SDK ships its own Session subclass (adding client metadata updates), overriding the
// headless one re-exported from the shared base above.
export { Session } from "./session/Session";
export { Session as SessionBase } from "@livelink.base/session/Session";

// The browser SDK augments the shared session event map (deprecated viewport event) and rebinds the
// client lifecycle events to the browser Client; the explicit re-exports override the SessionEvents
// and Client*Event symbols re-exported from the shared base above.
export { TO_REMOVE__ViewportsAddedEvent, ClientJoinedEvent, ClientLeftEvent } from "./session/SessionEvents";
export {
    ClientJoinedEvent as ClientJoinedEventBase,
    ClientLeftEvent as ClientLeftEventBase,
} from "@livelink.base/session/SessionEvents";
export type { SessionEvents } from "./session/SessionEvents";
export type { SessionEvents as SessionEventsBase } from "@livelink.base/session/SessionEvents";

// The browser SDK ships its own proxied entity & scene, overriding the headless
// ones re-exported from the shared base above.
export { Entity, type Transform, type Aabb } from "./scene/Entity";
export { Entity as EntityBase } from "@livelink.base/scene/Entity";

// The browser SDK augments the shared scene event map (proxied-Entity event payloads); the explicit
// re-export overrides the SceneEvents re-exported from the shared base above.
export { EntitiesCreatedEvent } from "./scene/SceneEvents";
export { EntitiesCreatedEvent as EntitiesCreatedEventBase } from "@livelink.base/scene/SceneEvents";
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
